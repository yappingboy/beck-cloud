import { useState } from 'react';
import { getLevel, useAuth } from '@/contexts/AuthContext';
import { TrialDialog } from '@/components/auth/TrialDialog';

/**
 * "Free plan | Start free trial" pill shown above the greeting for signed-in
 * free-plan users who haven't used their trial yet — the CADAM port of the
 * workspace pill. It renders nothing until billing has resolved (so it never
 * flashes on a paying user) and disappears once the trial has been used.
 *
 * The fade is mount-triggered (`animate-in fade-in`) rather than driven by a
 * parent `reveal` gate: because the pill only mounts after the network-backed
 * billing query resolves, a parent opacity flag would already be `true` by
 * then and the pill would pop in. Animating on mount fades it in whenever it
 * actually appears.
 *
 * `TrialDialog` is mounted on first open (not up front) so its
 * `useSubscriptionProducts` query doesn't fire for every free-plan visitor who
 * never opens it — and then stays mounted so Radix can play its close
 * animation, which a `{open && ...}` unmount would skip.
 */
export function FreePlanTrialPill() {
  const { user, billing, isLoading } = useAuth();
  const [trialOpen, setTrialOpen] = useState(false);
  const [dialogMounted, setDialogMounted] = useState(false);

  const level = getLevel(billing);
  const hasTrialed = billing?.user.hasTrialed ?? false;

  // Only signed-in free-plan users who can still start a trial, and only once
  // billing has resolved. The `!billing` guard matters because the billing
  // query throws on error — leaving `isLoading` false but `billing` null — and
  // `getLevel(null)` reads as 'free'. Without it, a paid user whose billing
  // fetch transiently fails would be shown the trial pill.
  if (!user || isLoading || !billing || level !== 'free' || hasTrialed) {
    return null;
  }

  return (
    <>
      <div className="duration-[350ms] inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] ease-out animate-in fade-in slide-in-from-bottom-1">
        <span className="text-adam-text-secondary">Free plan</span>
        <span className="h-4 w-px bg-white/10" aria-hidden="true" />
        <button
          type="button"
          onClick={() => {
            setDialogMounted(true);
            setTrialOpen(true);
          }}
          className="font-medium text-adam-blue transition-colors hover:text-adam-blue/80"
        >
          Start free trial
        </button>
      </div>
      {dialogMounted && (
        <TrialDialog open={trialOpen} onOpenChange={setTrialOpen} />
      )}
    </>
  );
}
