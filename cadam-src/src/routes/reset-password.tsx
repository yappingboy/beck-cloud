import { createFileRoute } from '@tanstack/react-router';
import { ResetPasswordView } from '@/views/ResetPasswordView';

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordView,
});
