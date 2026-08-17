// Marketing copy for each plan tier — price, name, and token amount come
// from the billing service (/v1/products), but the bullets below are a
// product decision that doesn't belong in the billing catalog.

export type PlanLevel = 'free' | 'standard' | 'pro' | 'max';

type PlanCopy = {
  description: string;
  features: string[];
};

export const PLAN_FEATURES: Record<PlanLevel, PlanCopy> = {
  free: {
    description: 'Get started with Adam',
    features: ['All AI features', 'Community support'],
  },
  standard: {
    description: 'For regular use',
    features: [
      'All AI features',
      'Tokens shared across CADAM, Onshape, and Fusion',
    ],
  },
  pro: {
    description: 'For power users',
    features: [
      'All AI features',
      'Priority support',
      'Tokens shared across CADAM, Onshape, and Fusion',
    ],
  },
  max: {
    description: 'For teams and heavy workloads',
    features: [
      'All AI features',
      'Priority support',
      'Tokens shared across CADAM, Onshape, and Fusion',
    ],
  },
};

export const PLAN_DISPLAY_NAMES: Record<PlanLevel, string> = {
  free: 'Free',
  standard: 'Standard',
  pro: 'Pro',
  max: 'Max',
};

export const PLAN_ORDER: PlanLevel[] = ['free', 'standard', 'pro', 'max'];
