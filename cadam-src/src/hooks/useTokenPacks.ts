import { apiJson } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import {
  billingProductSchema,
  type BillingProduct,
} from '@/hooks/useBillingProducts';
import { z } from 'zod';

const billingProductsSchema = z.array(billingProductSchema);

export function useTokenPacks() {
  return useQuery<BillingProduct[]>({
    queryKey: ['billing', 'products', 'pack'],
    queryFn: async () => {
      const products = await apiJson(
        'billing-products?type=pack',
        {},
        billingProductsSchema,
      );
      return [...products].sort((a, b) => a.tokenAmount - b.tokenAmount);
    },
  });
}
