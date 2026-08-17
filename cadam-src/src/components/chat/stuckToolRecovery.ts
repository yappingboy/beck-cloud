/**
 * Pure logic for the load-time stuck-tool recovery in `<ChatSession>`, kept
 * dependency-free so it's unit-testable in isolation (`deno test
 * src/components/chat/stuckToolRecovery.test.ts`). See the recovery effect in
 * `ChatSession.tsx` for the call site, and `src/server/chatToolPersistence.ts`
 * for the server-side twin of this sanitizer.
 */

/** Minimal structural shape of a message part — all we need to reason about. */
export type RecoveryPartLike = { type: string; state?: string };

export type RecoveryMessageLike = {
  id: string;
  role: string;
  parts: readonly RecoveryPartLike[];
};

export const STUCK_TOOL_ERROR_TEXT =
  'Tool execution did not complete in the previous session.';

/**
 * Scan a chat's messages for parts that never finished in a previous session
 * and return the rewritten `parts` arrays keyed by message id (empty map →
 * nothing to recover). Tool calls stuck at `input-streaming` /
 * `input-available` become `output-error`; `streaming` text / reasoning
 * becomes `done`. Every rewrite spreads the original part, so all
 * caller-specific fields survive — the caller re-narrows the structural
 * return to its own part type.
 *
 * Returns empty when the chat is ACTIVELY running (`streaming` /
 * `submitted`): a cached Chat instance survives ChatSession remounts
 * (PromptView handoff, switching back to a conversation mid-generation), and
 * a live stream legitimately holds `input-streaming` parts. Rewriting those
 * would kill an in-flight tool call — and the server's `onFinish` INSERT for
 * that row hasn't landed yet, so the recovery persist could never match it.
 * The live session's own handlers (`finishWithError`, `onError`) own
 * failures from here; recovery is only for chats that LOADED broken.
 */
export function collectStuckToolRecovery({
  status,
  messages,
}: {
  status: string;
  messages: readonly RecoveryMessageLike[];
}): Map<string, RecoveryPartLike[]> {
  const stuckByMessageId = new Map<string, RecoveryPartLike[]>();
  if (status === 'streaming' || status === 'submitted') {
    return stuckByMessageId;
  }

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    let dirty = false;
    const nextParts = msg.parts.map((p) => {
      if (
        (p.type.startsWith('tool-') || p.type === 'dynamic-tool') &&
        'state' in p &&
        (p.state === 'input-streaming' || p.state === 'input-available')
      ) {
        dirty = true;
        return {
          ...p,
          state: 'output-error',
          errorText: STUCK_TOOL_ERROR_TEXT,
        };
      }
      if (
        (p.type === 'reasoning' || p.type === 'text') &&
        p.state === 'streaming'
      ) {
        dirty = true;
        return { ...p, state: 'done' };
      }
      return p;
    });
    if (dirty) stuckByMessageId.set(msg.id, nextParts);
  }

  return stuckByMessageId;
}
