import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanAssistantText } from './parametricParts.ts';

describe('parametric assistant text cleanup', () => {
  it('removes leaked view metadata before final prose', () => {
    assert.equal(
      cleanAssistantText(
        ', viewpoint_state:{"distance":624},"zoom_info":A fallback automatic framing was used instead.}ளர்This 12 DOF robot arm is ready.',
      ),
      'This 12 DOF robot arm is ready.',
    );
  });

  it('removes metadata-only fragments', () => {
    assert.equal(
      cleanAssistantText(',title:Detailed San Francisco,version:v1}'),
      '',
    );
  });
});
