import { createFileRoute } from '@tanstack/react-router';
import { PromptView } from '@/views/PromptView';

export const Route = createFileRoute('/_layout/')({
  component: PromptView,
});
