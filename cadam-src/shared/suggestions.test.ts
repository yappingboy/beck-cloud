import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countSuggestionWords,
  limitSuggestionWords,
  normalizeConversationSuggestions,
} from './suggestions.ts';

describe('suggestion word limits', () => {
  it('counts whitespace-separated words', () => {
    assert.equal(countSuggestionWords('  add   mounting holes  '), 3);
    assert.equal(countSuggestionWords(''), 0);
  });

  it('treats punctuation and hyphenated terms as part of a word', () => {
    assert.equal(countSuggestionWords('make snap-fit tabs'), 3);
    assert.equal(countSuggestionWords('add ribs, fillets'), 3);
  });

  it('limits suggestions to three words', () => {
    assert.equal(
      limitSuggestionWords('make the brackets thicker'),
      'make the brackets',
    );
  });

  it('keeps valid suggestions before truncating fallback suggestions', () => {
    assert.deepEqual(
      normalizeConversationSuggestions([
        'make the brackets much thicker',
        'add fillets',
        '  add screw holes  ',
        'increase wall thickness',
      ]),
      ['add fillets', 'add screw holes'],
    );
  });

  it('deduplicates accepted suggestions before filling slots', () => {
    assert.deepEqual(
      normalizeConversationSuggestions([
        'add fillets',
        'add fillets',
        'add screw holes',
        'increase wall thickness',
      ]),
      ['add fillets', 'add screw holes'],
    );
  });

  it('truncates invalid suggestions only when needed to fill two slots', () => {
    assert.deepEqual(
      normalizeConversationSuggestions([
        'add chamfers',
        'make the handle much larger',
        'add four mounting holes',
      ]),
      ['add chamfers', 'make the handle'],
    );
  });
});
