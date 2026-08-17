drop trigger if exists "mesh_status_update_trigger" on "public"."meshes";

drop policy "Service role can manage all subscriptions" on "public"."subscriptions";

drop policy "Users can read their own subscriptions" on "public"."subscriptions";

drop policy "token_balances_read_own" on "public"."token_balances";

drop policy "token_costs_read" on "public"."token_costs";

drop policy "token_pack_products_read" on "public"."token_pack_products";

drop policy "token_transactions_read_own" on "public"."token_transactions";

drop policy "Enable users to view their own data only" on "public"."trial_users";

revoke delete on table "public"."subscriptions" from "anon";

revoke insert on table "public"."subscriptions" from "anon";

revoke references on table "public"."subscriptions" from "anon";

revoke select on table "public"."subscriptions" from "anon";

revoke trigger on table "public"."subscriptions" from "anon";

revoke truncate on table "public"."subscriptions" from "anon";

revoke update on table "public"."subscriptions" from "anon";

revoke delete on table "public"."subscriptions" from "authenticated";

revoke insert on table "public"."subscriptions" from "authenticated";

revoke references on table "public"."subscriptions" from "authenticated";

revoke select on table "public"."subscriptions" from "authenticated";

revoke trigger on table "public"."subscriptions" from "authenticated";

revoke truncate on table "public"."subscriptions" from "authenticated";

revoke update on table "public"."subscriptions" from "authenticated";

revoke delete on table "public"."subscriptions" from "service_role";

revoke insert on table "public"."subscriptions" from "service_role";

revoke references on table "public"."subscriptions" from "service_role";

revoke select on table "public"."subscriptions" from "service_role";

revoke trigger on table "public"."subscriptions" from "service_role";

revoke truncate on table "public"."subscriptions" from "service_role";

revoke update on table "public"."subscriptions" from "service_role";

revoke delete on table "public"."token_balances" from "anon";

revoke insert on table "public"."token_balances" from "anon";

revoke references on table "public"."token_balances" from "anon";

revoke select on table "public"."token_balances" from "anon";

revoke trigger on table "public"."token_balances" from "anon";

revoke truncate on table "public"."token_balances" from "anon";

revoke update on table "public"."token_balances" from "anon";

revoke delete on table "public"."token_balances" from "authenticated";

revoke insert on table "public"."token_balances" from "authenticated";

revoke references on table "public"."token_balances" from "authenticated";

revoke select on table "public"."token_balances" from "authenticated";

revoke trigger on table "public"."token_balances" from "authenticated";

revoke truncate on table "public"."token_balances" from "authenticated";

revoke update on table "public"."token_balances" from "authenticated";

revoke delete on table "public"."token_balances" from "service_role";

revoke insert on table "public"."token_balances" from "service_role";

revoke references on table "public"."token_balances" from "service_role";

revoke select on table "public"."token_balances" from "service_role";

revoke trigger on table "public"."token_balances" from "service_role";

revoke truncate on table "public"."token_balances" from "service_role";

revoke update on table "public"."token_balances" from "service_role";

revoke delete on table "public"."token_costs" from "anon";

revoke insert on table "public"."token_costs" from "anon";

revoke references on table "public"."token_costs" from "anon";

revoke select on table "public"."token_costs" from "anon";

revoke trigger on table "public"."token_costs" from "anon";

revoke truncate on table "public"."token_costs" from "anon";

revoke update on table "public"."token_costs" from "anon";

revoke delete on table "public"."token_costs" from "authenticated";

revoke insert on table "public"."token_costs" from "authenticated";

revoke references on table "public"."token_costs" from "authenticated";

revoke select on table "public"."token_costs" from "authenticated";

revoke trigger on table "public"."token_costs" from "authenticated";

revoke truncate on table "public"."token_costs" from "authenticated";

revoke update on table "public"."token_costs" from "authenticated";

revoke delete on table "public"."token_costs" from "service_role";

revoke insert on table "public"."token_costs" from "service_role";

revoke references on table "public"."token_costs" from "service_role";

revoke select on table "public"."token_costs" from "service_role";

revoke trigger on table "public"."token_costs" from "service_role";

revoke truncate on table "public"."token_costs" from "service_role";

revoke update on table "public"."token_costs" from "service_role";

revoke delete on table "public"."token_pack_products" from "anon";

revoke insert on table "public"."token_pack_products" from "anon";

revoke references on table "public"."token_pack_products" from "anon";

revoke select on table "public"."token_pack_products" from "anon";

revoke trigger on table "public"."token_pack_products" from "anon";

revoke truncate on table "public"."token_pack_products" from "anon";

revoke update on table "public"."token_pack_products" from "anon";

revoke delete on table "public"."token_pack_products" from "authenticated";

revoke insert on table "public"."token_pack_products" from "authenticated";

revoke references on table "public"."token_pack_products" from "authenticated";

revoke select on table "public"."token_pack_products" from "authenticated";

revoke trigger on table "public"."token_pack_products" from "authenticated";

revoke truncate on table "public"."token_pack_products" from "authenticated";

revoke update on table "public"."token_pack_products" from "authenticated";

revoke delete on table "public"."token_pack_products" from "service_role";

revoke insert on table "public"."token_pack_products" from "service_role";

revoke references on table "public"."token_pack_products" from "service_role";

revoke select on table "public"."token_pack_products" from "service_role";

revoke trigger on table "public"."token_pack_products" from "service_role";

revoke truncate on table "public"."token_pack_products" from "service_role";

revoke update on table "public"."token_pack_products" from "service_role";

revoke delete on table "public"."token_transactions" from "anon";

revoke insert on table "public"."token_transactions" from "anon";

revoke references on table "public"."token_transactions" from "anon";

revoke select on table "public"."token_transactions" from "anon";

revoke trigger on table "public"."token_transactions" from "anon";

revoke truncate on table "public"."token_transactions" from "anon";

revoke update on table "public"."token_transactions" from "anon";

revoke delete on table "public"."token_transactions" from "authenticated";

revoke insert on table "public"."token_transactions" from "authenticated";

revoke references on table "public"."token_transactions" from "authenticated";

revoke select on table "public"."token_transactions" from "authenticated";

revoke trigger on table "public"."token_transactions" from "authenticated";

revoke truncate on table "public"."token_transactions" from "authenticated";

revoke update on table "public"."token_transactions" from "authenticated";

revoke delete on table "public"."token_transactions" from "service_role";

revoke insert on table "public"."token_transactions" from "service_role";

revoke references on table "public"."token_transactions" from "service_role";

revoke select on table "public"."token_transactions" from "service_role";

revoke trigger on table "public"."token_transactions" from "service_role";

revoke truncate on table "public"."token_transactions" from "service_role";

revoke update on table "public"."token_transactions" from "service_role";

revoke delete on table "public"."trial_users" from "anon";

revoke insert on table "public"."trial_users" from "anon";

revoke references on table "public"."trial_users" from "anon";

revoke select on table "public"."trial_users" from "anon";

revoke trigger on table "public"."trial_users" from "anon";

revoke truncate on table "public"."trial_users" from "anon";

revoke update on table "public"."trial_users" from "anon";

revoke delete on table "public"."trial_users" from "authenticated";

revoke insert on table "public"."trial_users" from "authenticated";

revoke references on table "public"."trial_users" from "authenticated";

revoke select on table "public"."trial_users" from "authenticated";

revoke trigger on table "public"."trial_users" from "authenticated";

revoke truncate on table "public"."trial_users" from "authenticated";

revoke update on table "public"."trial_users" from "authenticated";

revoke delete on table "public"."trial_users" from "service_role";

revoke insert on table "public"."trial_users" from "service_role";

revoke references on table "public"."trial_users" from "service_role";

revoke select on table "public"."trial_users" from "service_role";

revoke trigger on table "public"."trial_users" from "service_role";

revoke truncate on table "public"."trial_users" from "service_role";

revoke update on table "public"."trial_users" from "service_role";

alter table "public"."subscriptions" drop constraint "subscriptions_status_check";

alter table "public"."subscriptions" drop constraint "subscriptions_user_id_fkey";

alter table "public"."token_balances" drop constraint "token_balances_balance_check";

alter table "public"."token_balances" drop constraint "token_balances_user_id_fkey";

alter table "public"."token_balances" drop constraint "token_balances_user_id_source_key";

alter table "public"."token_pack_products" drop constraint "token_pack_products_stripe_lookup_key_key";

alter table "public"."token_transactions" drop constraint "token_transactions_user_id_fkey";

alter table "public"."trial_users" drop constraint "trial_users_user_id_fkey";

alter table "public"."trial_users" drop constraint "trial_users_user_id_key";

drop function if exists "public"."credit_purchased_tokens"(p_user_id uuid, p_amount integer, p_reference_id text);

drop function if exists "public"."deduct_tokens"(p_user_id uuid, p_operation public.token_operation_type, p_reference_id text);

drop function if exists "public"."ensure_free_tier_fresh"(p_user_id uuid);

drop function if exists "public"."get_subscription_token_limit"(p_user_id uuid);

drop function if exists "public"."grant_subscription_tokens"(p_user_id uuid, p_token_amount integer, p_expires_at timestamp with time zone);

drop function if exists "public"."handle_mesh_status_update"();

drop function if exists "public"."refund_tokens"(p_user_id uuid, p_operation public.token_operation_type, p_reference_id text);

drop function if exists "public"."reset_free_tier_tokens"();

drop function if exists "public"."user_extradata"(user_id_input uuid);

drop type "public"."user_data";

alter table "public"."subscriptions" drop constraint "subscriptions_pkey";

alter table "public"."token_balances" drop constraint "token_balances_pkey";

alter table "public"."token_costs" drop constraint "token_costs_pkey";

alter table "public"."token_pack_products" drop constraint "token_pack_products_pkey";

alter table "public"."token_transactions" drop constraint "token_transactions_pkey";

alter table "public"."trial_users" drop constraint "trial_users_pkey";

drop index if exists "public"."idx_subscriptions_stripe_customer_id";

drop index if exists "public"."idx_subscriptions_stripe_subscription_id";

drop index if exists "public"."idx_subscriptions_user_id";

drop index if exists "public"."subscriptions_pkey";

drop index if exists "public"."token_balances_pkey";

drop index if exists "public"."token_balances_user_id_source_key";

drop index if exists "public"."token_costs_pkey";

drop index if exists "public"."token_pack_products_pkey";

drop index if exists "public"."token_pack_products_stripe_lookup_key_key";

drop index if exists "public"."token_transactions_pkey";

drop index if exists "public"."trial_users_pkey";

drop index if exists "public"."trial_users_user_id_key";

drop table "public"."subscriptions";

drop table "public"."token_balances";

drop table "public"."token_costs";

drop table "public"."token_pack_products";

drop table "public"."token_transactions";

drop table "public"."trial_users";

drop type "public"."stripe-level";

drop type "public"."subscription_level";

drop type "public"."token_operation_type";

drop type "public"."token_source_type";

set check_function_bodies = off;

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
  RETURN NEW;
END;
$function$
;


