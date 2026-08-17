import { apiJson } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

export type SubscriptionLevel = 'standard' | 'pro' | 'max';

export type BillingProduct = {
  id: string;
  stripeProductId: string;
  stripePriceId: string;
  productType: 'subscription' | 'pack';
  subscriptionLevel: SubscriptionLevel | null;
  tokenAmount: number;
  name: string;
  priceCents: number;
  interval: string | null;
  active: boolean;
};

export const billingProductSchema = z.object({
  id: z.string(),
  stripeProductId: z.string(),
  stripePriceId: z.string(),
  productType: z.union([z.literal('subscription'), z.literal('pack')]),
  subscriptionLevel: z
    .union([z.literal('standard'), z.literal('pro'), z.literal('max')])
    .nullable(),
  tokenAmount: z.number(),
  name: z.string(),
  priceCents: z.number(),
  interval: z.string().nullable(),
  active: z.boolean(),
});

const billingProductsSchema = z.array(billingProductSchema);

export function useSubscriptionProducts() {
  return useQuery<BillingProduct[]>({
    queryKey: ['billing', 'products', 'subscription'],
    queryFn: async () => {
      return apiJson(
        'billing-products?type=subscription',
        {},
        billingProductsSchema,
      );
    },
  });
}
