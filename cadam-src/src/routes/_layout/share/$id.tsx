import { createFileRoute } from '@tanstack/react-router';
import ShareView from '@/views/ShareView';

export const Route = createFileRoute('/_layout/share/$id')({
  component: ShareView,
});
