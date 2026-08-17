import { createFileRoute } from '@tanstack/react-router';
import { UpdatePasswordView } from '@/views/UpdatePasswordView';

export const Route = createFileRoute('/update-password')({
  component: UpdatePasswordView,
});
