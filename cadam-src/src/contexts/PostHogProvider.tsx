import { useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { analytics, initPostHog } from '@/lib/posthog';
import { useAuth } from '@/contexts/AuthContext';

interface PostHogProviderProps {
  children: React.ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  const location = useLocation();
  const { user } = useAuth();

  // Initialize PostHog once on mount
  useEffect(() => {
    initPostHog();
  }, []);

  // Identify user when authenticated
  useEffect(() => {
    if (!user) {
      analytics.reset();
      return;
    }

    analytics.identify(user.id, {
      email: user.email,
      created_at: user.created_at,
      is_anonymous: user.is_anonymous,
    });
  }, [user]);

  // Track page views on route change
  useEffect(() => {
    analytics.capture('$pageview', {
      $current_url: window.location.href,
    });
  }, [location.pathname]);

  return <>{children}</>;
}
