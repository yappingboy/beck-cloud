import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectStuckToolRecovery,
  STUCK_TOOL_ERROR_TEXT,
} from './stuckToolRecovery.ts';

const stuckBuildMessage = {
  id: 'a1',
  role: 'assistant',
  parts: [
    { type: 'text', text: 'Building…', state: 'done' },
    {
      type: 'tool-build_parametric_model',
      state: 'input-streaming',
      toolCallId: 'call-1',
    },
  ],
};

describe('collectStuckToolRecovery', () => {
  // Regression: a cached Chat that is mid-generation when ChatSession
  // (re)mounts (PromptView handoff, switching back to a conversation while
  // it streams) must NOT be treated as stuck — rewriting a live
  // `input-streaming` tool call kills the in-flight build, and the server's
  // `onFinish` INSERT hasn't landed yet so the recovery persist can never
  // match a row.
  it('skips recovery entirely while the chat is actively running', () => {
    for (const status of ['streaming', 'submitted']) {
      const result = collectStuckToolRecovery({
        status,
        messages: [stuckBuildMessage],
      });
      assert.equal(result.size, 0, `status=${status} should be skipped`);
    }
  });

  it('rewrites stuck tool calls to output-error on an idle chat', () => {
    for (const status of ['ready', 'error']) {
      const result = collectStuckToolRecovery({
        status,
        messages: [stuckBuildMessage],
      });
      assert.equal(result.size, 1, `status=${status} should recover`);
      const parts = result.get('a1')!;
      // text part untouched (same reference)
      assert.equal(parts[0], stuckBuildMessage.parts[0]);
      assert.deepEqual(parts[1], {
        type: 'tool-build_parametric_model',
        state: 'output-error',
        toolCallId: 'call-1',
        errorText: STUCK_TOOL_ERROR_TEXT,
      });
    }
  });

  it('handles dynamic-tool and input-available the same way', () => {
    const result = collectStuckToolRecovery({
      status: 'ready',
      messages: [
        {
          id: 'a2',
          role: 'assistant',
          parts: [{ type: 'dynamic-tool', state: 'input-available' }],
        },
      ],
    });
    assert.deepEqual(result.get('a2'), [
      {
        type: 'dynamic-tool',
        state: 'output-error',
        errorText: STUCK_TOOL_ERROR_TEXT,
      },
    ]);
  });

  it('finishes streaming text and reasoning parts', () => {
    const streamingTextMessage = {
      id: 'a3',
      role: 'assistant',
      parts: [
        { type: 'reasoning', state: 'streaming' },
        { type: 'text', text: 'partial', state: 'streaming' },
      ],
    };
    const result = collectStuckToolRecovery({
      status: 'ready',
      messages: [streamingTextMessage],
    });
    assert.deepEqual(result.get('a3'), [
      { type: 'reasoning', state: 'done' },
      { type: 'text', text: 'partial', state: 'done' },
    ]);
  });

  it('ignores resolved tools, user messages, and clean assistants', () => {
    const userMessage = {
      id: 'u1',
      role: 'user',
      // A user message can never be "stuck" even with odd part states.
      parts: [{ type: 'text', text: 'hi', state: 'streaming' }],
    };
    const cleanAssistantMessage = {
      id: 'a4',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'done', state: 'done' },
        { type: 'tool-build_parametric_model', state: 'output-available' },
        { type: 'tool-answer_user', state: 'output-error' },
      ],
    };
    const result = collectStuckToolRecovery({
      status: 'ready',
      messages: [userMessage, cleanAssistantMessage],
    });
    assert.equal(result.size, 0);
  });
});
