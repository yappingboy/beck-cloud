const MAX_SUGGESTION_WORDS = 3;
const MAX_SUGGESTIONS = 2;

export function countSuggestionWords(suggestion: string): number {
  const trimmed = suggestion.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function limitSuggestionWords(
  suggestion: string,
  maxWords = MAX_SUGGESTION_WORDS,
): string {
  return suggestion.trim().split(/\s+/).slice(0, maxWords).join(' ');
}

export function normalizeConversationSuggestions(
  suggestions: string[],
  maxSuggestions = MAX_SUGGESTIONS,
): string[] {
  const trimmedSuggestions = suggestions
    .map((suggestion) => suggestion.trim())
    .filter(Boolean);

  const accepted = Array.from(
    new Set(
      trimmedSuggestions.filter(
        (suggestion) =>
          countSuggestionWords(suggestion) <= MAX_SUGGESTION_WORDS,
      ),
    ),
  );

  if (accepted.length >= maxSuggestions) {
    return accepted.slice(0, maxSuggestions);
  }

  const seen = new Set(accepted);
  const fallback = trimmedSuggestions
    .filter(
      (suggestion) => countSuggestionWords(suggestion) > MAX_SUGGESTION_WORDS,
    )
    .map((suggestion) => limitSuggestionWords(suggestion))
    .filter((suggestion) => {
      if (!suggestion || seen.has(suggestion)) return false;
      seen.add(suggestion);
      return true;
    });

  return [...accepted, ...fallback].slice(0, maxSuggestions);
}
