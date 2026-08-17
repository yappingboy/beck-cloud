import { createFileRoute } from '@tanstack/react-router';
import {
  isRecord,
  isUnauthorizedError,
  json,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';
import { billing } from '@/server/billingClient';
import { env } from '@/server/env';

const appUrl = () => env('ADAM_URL') || 'https://adam.new/app';
const MAX_TRIAL_PERIOD_DAYS = 7;

export const Route = createFileRoute('/api/billing-checkout')({
  server: {
    handlers: {
      GET: methodNotAllowed,
      OPTIONS: preflight,
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const body = await request.json().catch(() => null);
          if (!isRecord(body) || typeof body.priceId !== 'string') {
            return json({ error: 'invalid_request' }, 400);
          }
          const trialPeriodDays =
            typeof body.trialPeriodDays === 'number'
              ? body.trialPeriodDays
              : undefined;
          if (
            trialPeriodDays !== undefined &&
            (!Number.isInteger(trialPeriodDays) ||
              trialPeriodDays < 0 ||
              trialPeriodDays > MAX_TRIAL_PERIOD_DAYS)
          ) {
            return json({ error: 'invalid_request' }, 400);
          }
          const result = await billing.createCheckout(user.email!, {
            priceId: body.priceId,
            successUrl: appUrl(),
            cancelUrl: appUrl(),
            trialPeriodDays,
          });
          return json(result);
        } catch (err) {
          return json(
            {
              error: isUnauthorizedError(err)
                ? 'Unauthorized'
                : 'checkout_failed',
            },
            isUnauthorizedError(err) ? 401 : 502,
          );
        }
      },
    },
  },
});
