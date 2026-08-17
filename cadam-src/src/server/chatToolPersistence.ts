/**
 * Pure logic for the chat persistence boundary, kept free of `@shared` and SDK
 * imports so it's unit-testable in isolation (`deno test
 * src/server/chatToolPersistence.test.ts`). The two concerns here are the only
 * things standing between a normal multi-step parametric turn and a
 * permanently-bricked conversation, so they're worth isolating and testing
 * directly. See `aiChat.ts` for the call sites.
 *
 * Background: the parametric tools (`build_parametric_model`, `answer_user`)
 * have no server `execute` — the browser is the sole authority for their
 * result. The server only ever sees them `input-available` (pending). If a
 * pending tool call ends up persisted in the branch, `convertToLanguageModelPrompt`
 * (inside `streamText` / the title+suggestion `generateText` calls) throws
 * `MissingToolResultsError` on the NEXT send and 500s it.
 */

/** Minimal structural shape of a message part — all we need to reason about. */
export type ToolPartLike = { type: string; state?: string };

export const DANGLING_TOOL_ERROR_TEXT =
  'Tool execution did not complete (the previous request was interrupted).';

/**
 * A message part that carries a tool call — either a statically-typed `tool-*`
 * part or the SDK's `dynamic-tool` part. Shared by the dangling check and the
 * pending check so the two can never drift out of sync (an asymmetry would let
 * a pending `dynamic-tool` take the clobbering write path).
 */
function isToolPart(part: ToolPartLike): boolean {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-');
}

/**
 * A tool-call part persisted without a result (stuck at `input-streaming` /
 * `input-available`).
 */
export function isDanglingToolPart(part: ToolPartLike): boolean {
  return (
    isToolPart(part) &&
    (part.state === 'input-streaming' || part.state === 'input-available')
  );
}

/**
 * Rewrite dangling tool calls to `output-error` so the history is valid — the
 * model receives a "tool did not complete" result and can recover. SAFETY NET
 * for genuine interruptions (tab close / crash / failed persist); the common
 * cause (the `onFinish` clobber) is prevented at the write side.
 */
export function resolveDanglingToolParts<T extends ToolPartLike>(
  parts: readonly T[],
): T[] {
  return parts.map((part) =>
    isDanglingToolPart(part)
      ? ({
          ...part,
          state: 'output-error',
          errorText: DANGLING_TOOL_ERROR_TEXT,
        } as unknown as T)
      : part,
  );
}

/**
 * Does this turn end awaiting a CLIENT-side tool result? `input-available`
 * means the model finished emitting the call but no result is attached — for
 * our client-resolved tools that means the browser still owns it.
 */
export function hasPendingClientToolCall(
  parts: readonly ToolPartLike[],
): boolean {
  return parts.some(
    (part) => isToolPart(part) && part.state === 'input-available',
  );
}

export type PersistAction = 'insert' | 'update' | 'skip';

/**
 * Decide what the server's `onFinish` should do with the response message.
 *
 * - `insert`  — new assistant row (the leaf was a user message). Always write,
 *   even with a pending tool call: the row must exist for the client's
 *   `onToolOutput` UPDATE to land, and the client resolves it before the
 *   auto-resubmit re-reads the branch.
 * - `update`  — continuation with everything resolved (or pure text / no
 *   tools). Safe to write; the client isn't persisting this turn.
 * - `skip`    — continuation that still ends with a pending CLIENT tool. The
 *   browser resolves and persists the `output-available` version itself; a
 *   server write here (delayed behind `result.totalUsage` + `billing.consume`)
 *   would land last and clobber it back to `input-available`, leaving a
 *   dangling tool call that 500s the next send. Defer to the client.
 */
export function decidePersistAction({
  isContinuation,
  hasPendingToolCall,
}: {
  isContinuation: boolean;
  hasPendingToolCall: boolean;
}): PersistAction {
  if (!isContinuation) return 'insert';
  return hasPendingToolCall ? 'skip' : 'update';
}
