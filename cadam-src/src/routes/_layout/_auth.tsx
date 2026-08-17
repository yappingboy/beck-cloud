import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AuthGuard } from '@/components/auth/AuthGuard';

export const Route = createFileRoute('/_layout/_auth')({
  component: AuthRoute,
});

function AuthRoute() {
  return (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  );
}
