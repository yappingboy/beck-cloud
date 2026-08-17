import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DANGLING_TOOL_ERROR_TEXT,
  decidePersistAction,
  hasPendingClientToolCall,
  isDanglingToolPart,
  resolveDanglingToolParts,
} from './chatToolPersistence.ts';

describe('isDanglingToolPart', () => {
  it('flags tool calls awaiting a result', () => {
    assert.equal(
      isDanglingToolPart({
        type: 'tool-answer_user',
        state: 'input-available',
      }),
      true,
    );
    assert.equal(
      isDanglingToolPart({
        type: 'tool-build_parametric_model',
        state: 'input-streaming',
      }),
      true,
    );
    assert.equal(
      isDanglingToolPart({ type: 'dynamic-tool', state: 'input-available' }),
      true,
    );
  });

  it('leaves resolved tool calls alone', () => {
    assert.equal(
      isDanglingToolPart({
        type: 'tool-build_parametric_model',
        state: 'output-available',
      }),
      false,
    );
    assert.equal(
      isDanglingToolPart({ type: 'tool-answer_user', state: 'output-error' }),
      false,
    );
  });

  it('ignores non-tool parts', () => {
    assert.equal(
      isDanglingToolPart({ type: 'text', state: 'streaming' }),
      false,
    );
    assert.equal(isDanglingToolPart({ type: 'reasoning' }), false);
    assert.equal(isDanglingToolPart({ type: 'step-start' }), false);
  });
});

describe('resolveDanglingToolParts', () => {
  it('rewrites only dangling tool calls to output-error and preserves the rest', () => {
    const parts = [
      { type: 'text', text: 'hi', state: 'done' },
      {
        type: 'tool-build_parametric_model',
        state: 'output-available',
        foo: 1,
      },
      { type: 'tool-answer_user', state: 'input-available', toolCallId: 'abc' },
    ];

    const result = resolveDanglingToolParts(parts);

    // text untouched (same reference)
    assert.equal(result[0], parts[0]);
    // resolved build untouched (same reference)
    assert.equal(result[1], parts[1]);
    // dangling answer_user rewritten
    assert.deepEqual(result[2], {
      type: 'tool-answer_user',
      state: 'output-error',
      toolCallId: 'abc',
      errorText: DANGLING_TOOL_ERROR_TEXT,
    });
  });

  it('is a no-op when nothing dangles', () => {
    const parts = [
      { type: 'tool-build_parametric_model', state: 'output-available' },
      { type: 'tool-answer_user', state: 'output-available' },
    ];
    const result = resolveDanglingToolParts(parts);
    assert.deepEqual(result, parts);
  });
});

describe('hasPendingClientToolCall', () => {
  it('detects a terminal pending tool call', () => {
    assert.equal(
      hasPendingClientToolCall([
        { type: 'tool-build_parametric_model', state: 'output-available' },
        { type: 'tool-answer_user', state: 'input-available' },
      ]),
      true,
    );
  });

  it('is false once everything is resolved', () => {
    assert.equal(
      hasPendingClientToolCall([
        { type: 'tool-build_parametric_model', state: 'output-available' },
        { type: 'tool-answer_user', state: 'output-available' },
      ]),
      false,
    );
  });

  it('is false for pure-text turns', () => {
    assert.equal(
      hasPendingClientToolCall([{ type: 'text', state: 'done' }]),
      false,
    );
  });

  it('treats a pending dynamic-tool as client-owned (symmetric with isDanglingToolPart)', () => {
    assert.equal(
      hasPendingClientToolCall([
        { type: 'dynamic-tool', state: 'input-available' },
      ]),
      true,
    );
    // Symmetry guard: anything dangling that is a tool part is also pending.
    assert.equal(
      isDanglingToolPart({ type: 'dynamic-tool', state: 'input-available' }),
      true,
    );
  });
});

describe('decidePersistAction — the clobber guard', () => {
  // The whole bug in one table: a continuation that still ends with a pending
  // client tool must NOT be written by the server, or it clobbers the client's
  // resolution and 500s the next send.
  it('inserts a fresh assistant row (leaf was a user message)', () => {
    // First parametric turn: build is pending, but we still must create the row.
    assert.equal(
      decidePersistAction({ isContinuation: false, hasPendingToolCall: true }),
      'insert',
    );
    assert.equal(
      decidePersistAction({ isContinuation: false, hasPendingToolCall: false }),
      'insert',
    );
  });

  it('skips the terminal answer_user continuation (the actual bug)', () => {
    assert.equal(
      decidePersistAction({ isContinuation: true, hasPendingToolCall: true }),
      'skip',
    );
  });

  it('updates a continuation once everything is resolved / pure text', () => {
    assert.equal(
      decidePersistAction({ isContinuation: true, hasPendingToolCall: false }),
      'update',
    );
  });
});

describe('end-to-end: a normal first turn never persists a dangling tool call', () => {
  // Walk the real sequence of onFinish decisions for: user → build → answer_user.
  it('insert(build pending) → skip(answer_user pending), so the row never gets clobbered', () => {
    // Turn 1, step 0: leaf is the user message, model emits build (pending).
    const buildPending = [
      { type: 'tool-build_parametric_model', state: 'input-available' },
    ];
    assert.equal(
      decidePersistAction({
        isContinuation: false,
        hasPendingToolCall: hasPendingClientToolCall(buildPending),
      }),
      'insert',
      'first build turn must create the row',
    );

    // Client resolves the build and resubmits; server continues and emits
    // answer_user (pending). This is the turn that used to clobber.
    const answerPending = [
      { type: 'tool-build_parametric_model', state: 'output-available' },
      { type: 'tool-answer_user', state: 'input-available' },
    ];
    assert.equal(
      decidePersistAction({
        isContinuation: true,
        hasPendingToolCall: hasPendingClientToolCall(answerPending),
      }),
      'skip',
      'terminal answer_user turn must defer to the client',
    );

    // The client persists the fully-resolved parts. On the NEXT send the
    // server reads this branch — nothing dangles, so no MissingToolResultsError.
    const persistedByClient = [
      { type: 'tool-build_parametric_model', state: 'output-available' },
      { type: 'tool-answer_user', state: 'output-available' },
    ];
    assert.deepEqual(
      resolveDanglingToolParts(persistedByClient),
      persistedByClient,
      'a healthy branch passes through the sanitizer untouched',
    );
  });
});
