import { createRouter as createTanStackRouter } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

type AppRouter = ReturnType<typeof createAppRouter>;

let clientRouter: AppRouter | undefined;

function createAppRouter() {
  return createTanStackRouter({
    routeTree,
    basepath: '/cadam',
    defaultPreload: 'intent',
    scrollRestoration: true,
  });
}

export function getRouter() {
  if (typeof window !== 'undefined') {
    clientRouter ??= createAppRouter();
    return clientRouter;
  }

  return createAppRouter();
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
