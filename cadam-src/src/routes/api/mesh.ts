import { createFileRoute } from '@tanstack/react-router';
import { handleMeshRequest } from '@/server/mesh';

export const Route = createFileRoute('/api/mesh')({
  server: {
    handlers: {
      GET: ({ request }) => handleMeshRequest(request),
      POST: ({ request }) => handleMeshRequest(request),
      OPTIONS: ({ request }) => handleMeshRequest(request),
    },
  },
});
