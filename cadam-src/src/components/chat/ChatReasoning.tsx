import { useEffect, useRef, useState } from 'react';
import { Streamdown } from 'streamdown';
import { cjk } from '@streamdown/cjk';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import { Shimmer } from '@/components/ai-elements/shimmer';
import {
  Reasoning,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import { CollapsibleContent } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSharedSpinnerVerb } from '@/hooks/useSharedSpinnerVerb';
import { cn } from '@/lib/utils';

// Mirrors `streamdownPlugins` from ai-elements/reasoning.tsx ReasoningContent
// so our custom-scrolling body keeps full markdown feature parity (code
// highlighting, math, mermaid, CJK) instead of regressing to bare Streamdown.
const streamdownPlugins = { cjk, code, math, mermaid };

interface ChatReasoningProps {
  text: string;
  isStreaming: boolean;
  className?: string;
}

/**
 * CADAM-tailored reasoning block.
 *
 * Wraps the ai-elements `Reasoning` + `ReasoningTrigger` primitives with our
 * own collapsible body so we get:
 *
 *  * A fixed scrollable area (max-h-72) with auto-scroll-to-bottom while the
 *    model is still streaming reasoning tokens.
 *  * A native scrollbar contained to the reasoning block itself — the outer
 *    chat ScrollArea is unaffected, so we don't end up with stacked
 *    scrollbars when the chat is also overflowing.
 *  * CADAM-themed muted text colors (the shadcn `text-muted-foreground` /
 *    `hover:text-foreground` tokens resolve to near-black on our :root,
 *    which is unreadable on the dark chat panel).
 *
 * The actual `ReasoningContent` from ai-elements is intentionally NOT used
 * here — it dumps Streamdown directly under CollapsibleContent with no
 * height cap, which lets very long chains of thought blow out the chat
 * panel. We render an identically-styled CollapsibleContent ourselves so
 * we can own the scroll + auto-scroll behavior without modifying the
 * upstream component.
 *
 * `isStreaming` is threaded down as a prop rather than read from
 * `useReasoning()` because the upstream context provider is declared
 * inside `ai-elements/reasoning.tsx` and consumers that resolve it
 * across module boundaries (HMR reloads, route splits) can see a null
 * value and throw "Reasoning components must be used within Reasoning"
 * even when the JSX is literally inside the provider. Prop-drilling
 * one boolean side-steps the entire class of bug.
 */
export function ChatReasoning({
  text,
  isStreaming,
  className,
}: ChatReasoningProps) {
  const thinkingVerb = useSharedSpinnerVerb(isStreaming);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    if (isStreaming) setIsDetailsOpen(false);
  }, [isStreaming]);

  return (
    <Reasoning
      defaultOpen={false}
      open={isDetailsOpen}
      onOpenChange={setIsDetailsOpen}
      isStreaming={isStreaming}
      className={cn('mb-0 mt-1 min-w-0 max-w-full overflow-hidden', className)}
    >
      <ReasoningTrigger
        className="min-h-9 text-adam-text-secondary hover:text-adam-text-primary"
        showIcon={false}
        getThinkingMessage={(streaming, duration) => {
          if (streaming || duration === 0) {
            return <Shimmer duration={1}>{`${thinkingVerb}...`}</Shimmer>;
          }
          if (duration === undefined) {
            return <p>Thought for a few seconds</p>;
          }
          return <p>Thought for {duration} seconds</p>;
        }}
      />
      {isDetailsOpen ? (
        <ChatReasoningBody isStreaming={isStreaming}>{text}</ChatReasoningBody>
      ) : null}
    </Reasoning>
  );
}

function ChatReasoningBody({
  children,
  isStreaming,
}: {
  children: string;
  isStreaming: boolean;
}) {
  // Ref points at the ScrollArea Root. We reach into the Radix Viewport
  // (the actual scroll container) by its data attribute and pin its
  // scrollTop to the bottom while the model is still streaming reasoning.
  // Once streaming finishes we stop forcing it so the user can scroll back
  // up to re-read whatever they want.
  const scrollRootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isStreaming) return;
    const viewport = scrollRootRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]',
    );
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [children, isStreaming]);

  return (
    <CollapsibleContent
      className={cn(
        'mt-4 min-w-0 max-w-full overflow-hidden text-sm text-adam-text-secondary outline-none',
        'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2',
        'data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
      )}
    >
      {/* Cap the Radix Viewport (not the Root) so the box only takes up
          space when the reasoning is actually that long — short chains of
          thought stay compact. The arbitrary-variant selector targets the
          Viewport's `data-*` attribute directly; `max-h-*` on the Root
          alone wouldn't work because the Viewport carries `h-full`. */}
      <ScrollArea
        ref={scrollRootRef}
        className="min-w-0 max-w-full overflow-hidden pr-3 [&_[data-radix-scroll-area-viewport]]:max-h-72 [&_[data-radix-scroll-area-viewport]]:overflow-x-hidden"
      >
        <div className="chat-markdown min-w-0 max-w-full overflow-hidden">
          <Streamdown parseIncompleteMarkdown plugins={streamdownPlugins}>
            {children}
          </Streamdown>
        </div>
      </ScrollArea>
    </CollapsibleContent>
  );
}
