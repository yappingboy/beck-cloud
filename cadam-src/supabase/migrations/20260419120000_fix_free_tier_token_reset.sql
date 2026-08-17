-- Fix free-tier daily token reset.
--
-- Bug 1: reset_free_tier_tokens() set expires_at = now() + 1 day. Because pg_cron
--        fires with small execution jitter, each day's stored expires_at crept
--        slightly ahead of the next cron's now(), and the gate
--        "expires_at < now()" made the cron skip its own prior resets.
--
-- Bug 2: user_extradata() and deduct_tokens() zero the displayed balance the
--        instant expires_at < now(). So any window between expiry and the next
--        (possibly skipped) cron caused users to see "You've used all your tokens"
--        with their real balance still sitting unchanged in the DB.
--
-- Fix: add a just-in-time reset on every read/deduct. The cron stays as a
-- backstop and is rewritten to pin expires_at to the next UTC day boundary so
-- it no longer drifts or skips.

CREATE OR REPLACE FUNCTION "public"."ensure_free_tier_fresh"("p_user_id" uuid)
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_free boolean;
    v_caller uuid;
BEGIN
    -- Only allow service role (server-side edge functions) or the user acting
    -- on themselves. auth.role() = 'anon' with uid = NULL would otherwise slip
    -- past a uid-only check. Silent return, not an exception, so that a
    -- legitimate caller's outer flow (user_extradata, deduct_tokens) continues
    -- on its own fallback path rather than erroring to the client.
    v_caller := auth.uid();
    IF auth.role() IS DISTINCT FROM 'service_role' AND v_caller IS DISTINCT FROM p_user_id THEN
        RETURN;
    END IF;

    SELECT NOT EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE user_id = p_user_id
        AND status IN ('active', 'trialing')
    ) INTO v_is_free;

    IF NOT v_is_free THEN
        RETURN;
    END IF;

    INSERT INTO public.token_balances (user_id, source, balance, expires_at, updated_at)
    VALUES (
        p_user_id,
        'subscription',
        50,
        date_trunc('day', now()) + interval '1 day',
        now()
    )
    ON CONFLICT (user_id, source) DO UPDATE
    SET balance = 50,
        expires_at = date_trunc('day', now()) + interval '1 day',
        updated_at = now()
    WHERE token_balances.expires_at IS NULL
       OR token_balances.expires_at <= now();
END;
$$;

CREATE OR REPLACE FUNCTION "public"."deduct_tokens"(
    "p_user_id" uuid,
    "p_operation" "public"."token_operation_type",
    "p_reference_id" text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE "plpgsql"
AS $$
DECLARE
    v_cost integer;
    v_sub_balance integer;
    v_pur_balance integer;
    v_sub_expires timestamptz;
    v_remaining integer;
    v_sub_deduct integer;
    v_pur_deduct integer;
BEGIN
    SELECT cost INTO v_cost FROM public.token_costs WHERE operation = p_operation;
    IF v_cost IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown_operation');
    END IF;

    PERFORM public.ensure_free_tier_fresh(p_user_id);

    SELECT balance, expires_at INTO v_sub_balance, v_sub_expires
    FROM public.token_balances
    WHERE user_id = p_user_id AND source = 'subscription'
    FOR UPDATE;

    -- Expired subscription tokens count as 0. For free-tier users this is
    -- unreachable after ensure_free_tier_fresh (expires_at is always future).
    -- It is load-bearing for paid users whose billing-cycle sub has lapsed,
    -- and for the edge case where ensure_free_tier_fresh silently bailed
    -- (auth-mismatch). Don't remove without preserving both cases.
    IF v_sub_expires IS NOT NULL AND v_sub_expires < now() THEN
        v_sub_balance := 0;
    END IF;

    SELECT balance INTO v_pur_balance
    FROM public.token_balances
    WHERE user_id = p_user_id AND source = 'purchased'
    FOR UPDATE;

    v_sub_balance := COALESCE(v_sub_balance, 0);
    v_pur_balance := COALESCE(v_pur_balance, 0);

    IF (v_sub_balance + v_pur_balance) < v_cost THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'insufficient_tokens',
            'tokensRequired', v_cost,
            'tokensAvailable', v_sub_balance + v_pur_balance
        );
    END IF;

    v_sub_deduct := LEAST(v_cost, v_sub_balance);
    v_pur_deduct := v_cost - v_sub_deduct;

    IF v_sub_deduct > 0 THEN
        UPDATE public.token_balances
        SET balance = balance - v_sub_deduct, updated_at = now()
        WHERE user_id = p_user_id AND source = 'subscription';
    END IF;

    IF v_pur_deduct > 0 THEN
        UPDATE public.token_balances
        SET balance = balance - v_pur_deduct, updated_at = now()
        WHERE user_id = p_user_id AND source = 'purchased';
    END IF;

    INSERT INTO public.token_transactions (
        user_id, operation, amount, source, reference_id,
        subscription_balance_after, purchased_balance_after
    ) VALUES (
        p_user_id, p_operation, -v_cost,
        CASE WHEN v_sub_deduct > 0 THEN 'subscription'::public.token_source_type ELSE 'purchased'::public.token_source_type END,
        p_reference_id,
        v_sub_balance - v_sub_deduct,
        v_pur_balance - v_pur_deduct
    );

    RETURN jsonb_build_object(
        'success', true,
        'tokensDeducted', v_cost,
        'subscriptionBalance', v_sub_balance - v_sub_deduct,
        'purchasedBalance', v_pur_balance - v_pur_deduct,
        'totalBalance', (v_sub_balance - v_sub_deduct) + (v_pur_balance - v_pur_deduct)
    );
END;
$$;

CREATE OR REPLACE FUNCTION "public"."reset_free_tier_tokens"()
RETURNS void
LANGUAGE "plpgsql"
AS $$
BEGIN
    UPDATE public.token_balances tb
    SET balance = 50,
        expires_at = date_trunc('day', now()) + interval '1 day',
        updated_at = now()
    WHERE tb.source = 'subscription'
    AND NOT EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.user_id = tb.user_id
        AND s.status IN ('active', 'trialing')
    )
    -- Idempotency guard: don't re-credit users whose period is still live.
    -- With expires_at pinned to the day boundary, the scheduled midnight run
    -- satisfies `<=` exactly; manual or retried mid-day runs are safely no-ops.
    AND (tb.expires_at IS NULL OR tb.expires_at <= now());
END;
$$;

CREATE OR REPLACE FUNCTION "public"."user_extradata"("user_id_input" "uuid")
RETURNS "public"."user_data"
LANGUAGE "plpgsql"
AS $$
DECLARE
    hasTrialed boolean;
    userlevel public.subscriptions.level%TYPE;
    userstatus public.subscriptions.status%TYPE;
    v_sub_balance integer;
    v_pur_balance integer;
    v_sub_expires timestamptz;
    v_sub_limit integer;
    ret user_data;
BEGIN
    PERFORM public.ensure_free_tier_fresh(user_id_input);

    SELECT (
        (SELECT count(*) FROM public.trial_users WHERE user_id = user_id_input) > 0
    ) INTO hasTrialed;

    SELECT STATUS, LEVEL INTO userstatus, userlevel
    FROM public.subscriptions
    WHERE user_id = user_id_input;

    SELECT balance, expires_at INTO v_sub_balance, v_sub_expires
    FROM public.token_balances
    WHERE user_id = user_id_input AND source = 'subscription';

    SELECT balance INTO v_pur_balance
    FROM public.token_balances
    WHERE user_id = user_id_input AND source = 'purchased';

    v_sub_balance := COALESCE(v_sub_balance, 0);
    v_pur_balance := COALESCE(v_pur_balance, 0);

    -- See matching comment in deduct_tokens: this branch is load-bearing for
    -- paid users whose billing-cycle sub has lapsed and as a fallback if
    -- ensure_free_tier_fresh silently bailed. Do not remove.
    IF v_sub_expires IS NOT NULL AND v_sub_expires < now() THEN
        v_sub_balance := 0;
    END IF;

    ret."hasTrialed" = hasTrialed;

    IF (userstatus = 'active') THEN
        ret."sublevel" = userlevel;
    ELSIF (userstatus = 'trialing') THEN
        ret."sublevel" = 'pro';
    ELSE
        ret."sublevel" = 'free';
    END IF;

    v_sub_limit := public.get_subscription_token_limit(user_id_input);

    ret."subscriptionTokens" = v_sub_balance;
    ret."purchasedTokens" = v_pur_balance;
    ret."totalTokens" = v_sub_balance + v_pur_balance;
    ret."subscriptionTokenLimit" = v_sub_limit;
    ret."subscriptionExpiresAt" = v_sub_expires;

    RETURN ret;

EXCEPTION
    WHEN others THEN
        RAISE EXCEPTION 'An error occurred in function user_extradata(): %', SQLERRM;
END;
$$;
