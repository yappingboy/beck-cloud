import posthog from 'posthog-js';
import { apiUrl } from '@/services/api';

const POSTHOG_KEY =
  import.meta.env.VITE_POSTHOG_PROJECT_KEY ?? import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST || apiUrl('jackson-pollock');

let isInitialized = false;

export const initPostHog = () => {
  if (!POSTHOG_KEY) {
    console.warn('PostHog key not configured. Analytics disabled.');
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'always',
    capture_pageview: false, // We'll handle this manually with React Router
    capture_pageleave: true,
    autocapture: true,
  });

  isInitialized = true;
};

// Safe wrapper that only calls PostHog methods when initialized
export const analytics = {
  identify: (userId: string, properties?: Record<string, unknown>) => {
    if (isInitialized) {
      posthog.identify(userId, properties);
    }
  },
  reset: () => {
    if (isInitialized) {
      posthog.reset();
    }
  },
  capture: (event: string, properties?: Record<string, unknown>) => {
    if (isInitialized) {
      posthog.capture(event, properties);
    }
  },
};
