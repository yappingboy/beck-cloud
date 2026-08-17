import { createFileRoute } from '@tanstack/react-router';
import EditorView from '@/views/EditorView';

export const Route = createFileRoute('/_layout/_auth/editor/$id')({
  component: EditorView,
});
