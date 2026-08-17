import { createFileRoute } from '@tanstack/react-router';
import EmailConfirmation from '@/views/EmailConfirmation';

export const Route = createFileRoute('/confirm-email')({
  component: EmailConfirmation,
});
