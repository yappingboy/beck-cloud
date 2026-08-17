import { AuthProvider } from '@/contexts/AuthProvider';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/toaster';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet } from '@tanstack/react-router';
import { MeshFilesProvider } from '@/contexts/MeshFilesContext';
import { PostHogProvider } from '@/contexts/PostHogProvider';
import { ErrorView } from '@/views/ErrorView';
import { isSupabaseConfigMissing } from '@/lib/supabase';

const queryClient = new QueryClient();

function MissingConfig() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-adam-bg-secondary-dark">
      <div className="max-w-xl px-4 text-center text-red-500">
        Missing API Keys. Please copy .env.local.template to .env.local and
        restart.
      </div>
    </div>
  );
}

function App({ error }: { error?: unknown }) {
  if (isSupabaseConfigMissing) {
    return <MissingConfig />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PostHogProvider>
          <MeshFilesProvider>
            <TooltipProvider delayDuration={0}>
              <Toaster />
              {error !== undefined ? <ErrorView error={error} /> : <Outlet />}
            </TooltipProvider>
          </MeshFilesProvider>
        </PostHogProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
