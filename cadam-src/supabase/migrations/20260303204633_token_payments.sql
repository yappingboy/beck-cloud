create extension if not exists "pg_cron" with schema "pg_catalog";

create type "public"."token_operation_type" as enum ('mesh', 'parametric', 'chat', 'refund');

create type "public"."token_source_type" as enum ('subscription', 'purchased');

drop trigger if exists "mesh_insert_prompt_trigger" on "public"."meshes";

drop function if exists "public"."handle_mesh_insert"();

drop function if exists "public"."user_extradata"(uuid);

drop type "public"."user_data";


  create table "public"."token_balances" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "source" public.token_source_type not null,
    "balance" integer not null default 0,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."token_balances" enable row level security;


  create table "public"."token_costs" (
    "operation" public.token_operation_type not null,
    "cost" integer not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."token_costs" enable row level security;


  create table "public"."token_pack_products" (
    "id" uuid not null default gen_random_uuid(),
    "stripe_lookup_key" text not null,
    "token_amount" integer not null,
    "name" text not null,
    "price_cents" integer not null,
    "active" boolean not null default true,
    "created_at" timestamp with time zone not null default now()
      );

-- Default costs
INSERT INTO "public"."token_costs" ("operation", "cost") VALUES
    ('mesh', 30),
    ('parametric', 5),
    ('chat', 1);

alter table "public"."token_pack_products" enable row level security;


  create table "public"."token_transactions" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "operation" public.token_operation_type not null,
    "amount" integer not null,
    "source" public.token_source_type not null,
    "reference_id" text,
    "subscription_balance_after" integer not null,
    "purchased_balance_after" integer not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."token_transactions" enable row level security;

CREATE UNIQUE INDEX token_balances_pkey ON public.token_balances USING btree (id);

CREATE UNIQUE INDEX token_balances_user_id_source_key ON public.token_balances USING btree (user_id, source);

CREATE UNIQUE INDEX token_costs_pkey ON public.token_costs USING btree (operation);

CREATE UNIQUE INDEX token_pack_products_pkey ON public.token_pack_products USING btree (id);

CREATE UNIQUE INDEX token_pack_products_stripe_lookup_key_key ON public.token_pack_products USING btree (stripe_lookup_key);

CREATE UNIQUE INDEX token_transactions_pkey ON public.token_transactions USING btree (id);

alter table "public"."token_balances" add constraint "token_balances_pkey" PRIMARY KEY using index "token_balances_pkey";

alter table "public"."token_costs" add constraint "token_costs_pkey" PRIMARY KEY using index "token_costs_pkey";

alter table "public"."token_pack_products" add constraint "token_pack_products_pkey" PRIMARY KEY using index "token_pack_products_pkey";

alter table "public"."token_transactions" add constraint "token_transactions_pkey" PRIMARY KEY using index "token_transactions_pkey";

alter table "public"."token_balances" add constraint "token_balances_balance_check" CHECK ((balance >= 0)) not valid;

alter table "public"."token_balances" validate constraint "token_balances_balance_check";

alter table "public"."token_balances" add constraint "token_balances_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."token_balances" validate constraint "token_balances_user_id_fkey";

alter table "public"."token_balances" add constraint "token_balances_user_id_source_key" UNIQUE using index "token_balances_user_id_source_key";

alter table "public"."token_pack_products" add constraint "token_pack_products_stripe_lookup_key_key" UNIQUE using index "token_pack_products_stripe_lookup_key_key";

alter table "public"."token_transactions" add constraint "token_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."token_transactions" validate constraint "token_transactions_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.credit_purchased_tokens(p_user_id uuid, p_amount integer, p_reference_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_new_balance integer;
    v_sub_balance integer;
BEGIN
    INSERT INTO public.token_balances (user_id, source, balance)
    VALUES (p_user_id, 'purchased'::public.token_source_type, p_amount)
    ON CONFLICT (user_id, source) DO UPDATE
    SET balance = token_balances.balance + p_amount, updated_at = now()
    RETURNING balance INTO v_new_balance;

    SELECT COALESCE(balance, 0) INTO v_sub_balance
    FROM public.token_balances
    WHERE user_id = p_user_id AND source = 'subscription'::public.token_source_type;

    v_sub_balance := COALESCE(v_sub_balance, 0);

    INSERT INTO public.token_transactions (
        user_id, operation, amount, source, reference_id,
        subscription_balance_after, purchased_balance_after
    ) VALUES (
        p_user_id, 'chat'::public.token_operation_type, p_amount, 'purchased'::public.token_source_type, p_reference_id,
        v_sub_balance, v_new_balance
    );

    RETURN jsonb_build_object(
        'success', true,
        'tokensAdded', p_amount,
        'purchasedBalance', v_new_balance
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.deduct_tokens(p_user_id uuid, p_operation public.token_operation_type, p_reference_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_cost integer;
    v_sub_balance integer;
    v_pur_balance integer;
    v_sub_expires timestamptz;
    v_remaining integer;
    v_sub_deduct integer;
    v_pur_deduct integer;
BEGIN
    -- Get cost for operation
    SELECT cost INTO v_cost FROM public.token_costs WHERE operation = p_operation;
    IF v_cost IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown_operation');
    END IF;

    -- Lock and read subscription balance
    SELECT balance, expires_at INTO v_sub_balance, v_sub_expires
    FROM public.token_balances
    WHERE user_id = p_user_id AND source = 'subscription'
    FOR UPDATE;

    -- If subscription tokens have expired, treat as 0
    IF v_sub_expires IS NOT NULL AND v_sub_expires < now() THEN
        v_sub_balance := 0;
    END IF;

    -- Lock and read purchased balance
    SELECT balance INTO v_pur_balance
    FROM public.token_balances
    WHERE user_id = p_user_id AND source = 'purchased'
    FOR UPDATE;

    -- Default to 0 if no rows exist
    v_sub_balance := COALESCE(v_sub_balance, 0);
    v_pur_balance := COALESCE(v_pur_balance, 0);

    -- Check total available
    IF (v_sub_balance + v_pur_balance) < v_cost THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'insufficient_tokens',
            'tokensRequired', v_cost,
            'tokensAvailable', v_sub_balance + v_pur_balance
        );
    END IF;

    -- Consume subscription tokens first (they expire anyway)
    v_sub_deduct := LEAST(v_cost, v_sub_balance);
    v_pur_deduct := v_cost - v_sub_deduct;

    -- Update subscription balance
    IF v_sub_deduct > 0 THEN
        UPDATE public.token_balances
        SET balance = balance - v_sub_deduct, updated_at = now()
        WHERE user_id = p_user_id AND source = 'subscription';
    END IF;

    -- Update purchased balance
    IF v_pur_deduct > 0 THEN
        UPDATE public.token_balances
        SET balance = balance - v_pur_deduct, updated_at = now()
        WHERE user_id = p_user_id AND source = 'purchased';
    END IF;

    -- Record transaction
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_subscription_token_limit(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    userlevel public.subscriptions.level%TYPE;
    userstatus public.subscriptions.status%TYPE;
BEGIN
    SELECT status, level INTO userstatus, userlevel
    FROM public.subscriptions
    WHERE user_id = p_user_id;

    IF userstatus = 'active' OR userstatus = 'trialing' THEN
        IF userlevel = 'pro' THEN
            RETURN 5000;
        ELSIF userlevel = 'standard' THEN
            RETURN 1000;
        END IF;
    END IF;

    -- Free tier
    RETURN 50;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.grant_subscription_tokens(p_user_id uuid, p_token_amount integer, p_expires_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_pur_balance integer;
BEGIN
    INSERT INTO public.token_balances (user_id, source, balance, expires_at)
    VALUES (p_user_id, 'subscription'::public.token_source_type, p_token_amount, p_expires_at)
    ON CONFLICT (user_id, source) DO UPDATE
    SET balance = p_token_amount, expires_at = p_expires_at, updated_at = now();

    SELECT COALESCE(balance, 0) INTO v_pur_balance
    FROM public.token_balances
    WHERE user_id = p_user_id AND source = 'purchased'::public.token_source_type;

    v_pur_balance := COALESCE(v_pur_balance, 0);

    INSERT INTO public.token_transactions (
        user_id, operation, amount, source, reference_id,
        subscription_balance_after, purchased_balance_after
    ) VALUES (
        p_user_id, 'chat'::public.token_operation_type, p_token_amount, 'subscription'::public.token_source_type, 'subscription_grant',
        p_token_amount, v_pur_balance
    );

    RETURN jsonb_build_object(
        'success', true,
        'tokensGranted', p_token_amount,
        'subscriptionBalance', p_token_amount,
        'expiresAt', p_expires_at
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refund_tokens(p_user_id uuid, p_operation public.token_operation_type, p_reference_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_cost integer;
    v_sub_balance integer;
    v_pur_balance integer;
    v_sub_limit integer;
    v_sub_refund integer;
    v_pur_refund integer;
BEGIN
    -- Get cost for operation
    SELECT cost INTO v_cost FROM public.token_costs WHERE operation = p_operation;
    IF v_cost IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown_operation');
    END IF;

    -- Get current balances with lock
    SELECT balance INTO v_sub_balance
    FROM public.token_balances
    WHERE user_id = p_user_id AND source = 'subscription'
    FOR UPDATE;

    SELECT balance INTO v_pur_balance
    FROM public.token_balances
    WHERE user_id = p_user_id AND source = 'purchased'
    FOR UPDATE;

    v_sub_balance := COALESCE(v_sub_balance, 0);
    v_pur_balance := COALESCE(v_pur_balance, 0);

    -- Get subscription tier limit
    v_sub_limit := public.get_subscription_token_limit(p_user_id);

    -- Refund to subscription first (up to tier limit), remainder to purchased
    v_sub_refund := LEAST(v_cost, v_sub_limit - v_sub_balance);
    v_sub_refund := GREATEST(v_sub_refund, 0);
    v_pur_refund := v_cost - v_sub_refund;

    -- Update balances
    IF v_sub_refund > 0 THEN
        UPDATE public.token_balances
        SET balance = balance + v_sub_refund, updated_at = now()
        WHERE user_id = p_user_id AND source = 'subscription';
    END IF;

    IF v_pur_refund > 0 THEN
        UPDATE public.token_balances
        SET balance = balance + v_pur_refund, updated_at = now()
        WHERE user_id = p_user_id AND source = 'purchased';
    END IF;

    -- Record refund transaction
    INSERT INTO public.token_transactions (
        user_id, operation, amount, source, reference_id,
        subscription_balance_after, purchased_balance_after
    ) VALUES (
        p_user_id, 'refund'::public.token_operation_type, v_cost,
        CASE WHEN v_sub_refund > 0 THEN 'subscription'::public.token_source_type ELSE 'purchased'::public.token_source_type END,
        p_reference_id,
        v_sub_balance + v_sub_refund,
        v_pur_balance + v_pur_refund
    );

    RETURN jsonb_build_object(
        'success', true,
        'tokensRefunded', v_cost,
        'subscriptionBalance', v_sub_balance + v_sub_refund,
        'purchasedBalance', v_pur_balance + v_pur_refund
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reset_free_tier_tokens()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE public.token_balances tb
    SET balance = 50,
        expires_at = now() + interval '1 day',
        updated_at = now()
    WHERE tb.source = 'subscription'
    AND NOT EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.user_id = tb.user_id
        AND s.status IN ('active', 'trialing')
    )
    AND (tb.expires_at IS NULL OR tb.expires_at < now());
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_mesh_status_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- If mesh status changed to 'failure', refund the tokens
    IF OLD.status != 'failure' AND NEW.status = 'failure' THEN
        PERFORM public.refund_tokens(NEW.user_id, 'mesh'::public.token_operation_type, NEW.id::text);
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  );

  -- Initialize subscription token balance (free tier: 50 tokens, 1-day expiry)
  INSERT INTO public.token_balances (user_id, source, balance, expires_at)
  VALUES (NEW.id, 'subscription'::public.token_source_type, 50, now() + interval '1 day');

  -- Initialize purchased token balance (0)
  INSERT INTO public.token_balances (user_id, source, balance)
  VALUES (NEW.id, 'purchased'::public.token_source_type, 0);

  RETURN NEW;
END;
$function$
;

create type "public"."user_data" as ("hasTrialed" boolean, "sublevel" public.subscription_level, "subscriptionTokens" integer, "purchasedTokens" integer, "totalTokens" integer, "subscriptionTokenLimit" integer, "subscriptionExpiresAt" timestamp with time zone);

CREATE OR REPLACE FUNCTION public.user_extradata(user_id_input uuid)
 RETURNS public.user_data
 LANGUAGE plpgsql
 STABLE
AS $function$
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
    -- Get trial status
    SELECT (
        (SELECT count(*) FROM public.trial_users WHERE user_id = user_id_input) > 0
    ) INTO hasTrialed;

    -- Get subscription info
    SELECT STATUS, LEVEL INTO userstatus, userlevel
    FROM public.subscriptions
    WHERE user_id = user_id_input;

    -- Get token balances
    SELECT balance, expires_at INTO v_sub_balance, v_sub_expires
    FROM public.token_balances
    WHERE user_id = user_id_input AND source = 'subscription';

    SELECT balance INTO v_pur_balance
    FROM public.token_balances
    WHERE user_id = user_id_input AND source = 'purchased';

    v_sub_balance := COALESCE(v_sub_balance, 0);
    v_pur_balance := COALESCE(v_pur_balance, 0);

    -- If subscription tokens have expired, treat as 0
    IF v_sub_expires IS NOT NULL AND v_sub_expires < now() THEN
        v_sub_balance := 0;
    END IF;

    -- Set return values
    ret."hasTrialed" = hasTrialed;

    -- Set subscription level
    IF (userstatus = 'active') THEN
        ret."sublevel" = userlevel;
    ELSIF (userstatus = 'trialing') THEN
        ret."sublevel" = 'pro';
    ELSE
        ret."sublevel" = 'free';
    END IF;

    -- Get token limit for tier
    v_sub_limit := public.get_subscription_token_limit(user_id_input);

    -- Set token values
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
$function$
;

grant delete on table "public"."token_balances" to "anon";

grant insert on table "public"."token_balances" to "anon";

grant references on table "public"."token_balances" to "anon";

grant select on table "public"."token_balances" to "anon";

grant trigger on table "public"."token_balances" to "anon";

grant truncate on table "public"."token_balances" to "anon";

grant update on table "public"."token_balances" to "anon";

grant delete on table "public"."token_balances" to "authenticated";

grant insert on table "public"."token_balances" to "authenticated";

grant references on table "public"."token_balances" to "authenticated";

grant select on table "public"."token_balances" to "authenticated";

grant trigger on table "public"."token_balances" to "authenticated";

grant truncate on table "public"."token_balances" to "authenticated";

grant update on table "public"."token_balances" to "authenticated";

grant delete on table "public"."token_balances" to "service_role";

grant insert on table "public"."token_balances" to "service_role";

grant references on table "public"."token_balances" to "service_role";

grant select on table "public"."token_balances" to "service_role";

grant trigger on table "public"."token_balances" to "service_role";

grant truncate on table "public"."token_balances" to "service_role";

grant update on table "public"."token_balances" to "service_role";

grant delete on table "public"."token_costs" to "anon";

grant insert on table "public"."token_costs" to "anon";

grant references on table "public"."token_costs" to "anon";

grant select on table "public"."token_costs" to "anon";

grant trigger on table "public"."token_costs" to "anon";

grant truncate on table "public"."token_costs" to "anon";

grant update on table "public"."token_costs" to "anon";

grant delete on table "public"."token_costs" to "authenticated";

grant insert on table "public"."token_costs" to "authenticated";

grant references on table "public"."token_costs" to "authenticated";

grant select on table "public"."token_costs" to "authenticated";

grant trigger on table "public"."token_costs" to "authenticated";

grant truncate on table "public"."token_costs" to "authenticated";

grant update on table "public"."token_costs" to "authenticated";

grant delete on table "public"."token_costs" to "service_role";

grant insert on table "public"."token_costs" to "service_role";

grant references on table "public"."token_costs" to "service_role";

grant select on table "public"."token_costs" to "service_role";

grant trigger on table "public"."token_costs" to "service_role";

grant truncate on table "public"."token_costs" to "service_role";

grant update on table "public"."token_costs" to "service_role";

grant delete on table "public"."token_pack_products" to "anon";

grant insert on table "public"."token_pack_products" to "anon";

grant references on table "public"."token_pack_products" to "anon";

grant select on table "public"."token_pack_products" to "anon";

grant trigger on table "public"."token_pack_products" to "anon";

grant truncate on table "public"."token_pack_products" to "anon";

grant update on table "public"."token_pack_products" to "anon";

grant delete on table "public"."token_pack_products" to "authenticated";

grant insert on table "public"."token_pack_products" to "authenticated";

grant references on table "public"."token_pack_products" to "authenticated";

grant select on table "public"."token_pack_products" to "authenticated";

grant trigger on table "public"."token_pack_products" to "authenticated";

grant truncate on table "public"."token_pack_products" to "authenticated";

grant update on table "public"."token_pack_products" to "authenticated";

grant delete on table "public"."token_pack_products" to "service_role";

grant insert on table "public"."token_pack_products" to "service_role";

grant references on table "public"."token_pack_products" to "service_role";

grant select on table "public"."token_pack_products" to "service_role";

grant trigger on table "public"."token_pack_products" to "service_role";

grant truncate on table "public"."token_pack_products" to "service_role";

grant update on table "public"."token_pack_products" to "service_role";

grant delete on table "public"."token_transactions" to "anon";

grant insert on table "public"."token_transactions" to "anon";

grant references on table "public"."token_transactions" to "anon";

grant select on table "public"."token_transactions" to "anon";

grant trigger on table "public"."token_transactions" to "anon";

grant truncate on table "public"."token_transactions" to "anon";

grant update on table "public"."token_transactions" to "anon";

grant delete on table "public"."token_transactions" to "authenticated";

grant insert on table "public"."token_transactions" to "authenticated";

grant references on table "public"."token_transactions" to "authenticated";

grant select on table "public"."token_transactions" to "authenticated";

grant trigger on table "public"."token_transactions" to "authenticated";

grant truncate on table "public"."token_transactions" to "authenticated";

grant update on table "public"."token_transactions" to "authenticated";

grant delete on table "public"."token_transactions" to "service_role";

grant insert on table "public"."token_transactions" to "service_role";

grant references on table "public"."token_transactions" to "service_role";

grant select on table "public"."token_transactions" to "service_role";

grant trigger on table "public"."token_transactions" to "service_role";

grant truncate on table "public"."token_transactions" to "service_role";

grant update on table "public"."token_transactions" to "service_role";


  create policy "token_balances_read_own"
  on "public"."token_balances"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "token_costs_read"
  on "public"."token_costs"
  as permissive
  for select
  to authenticated
using (true);



  create policy "token_pack_products_read"
  on "public"."token_pack_products"
  as permissive
  for select
  to authenticated
using ((active = true));



  create policy "token_transactions_read_own"
  on "public"."token_transactions"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



