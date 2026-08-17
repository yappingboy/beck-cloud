import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import App from '@/App';
import appCss from '@/index.css?url';

const assetUrl = (path: string) =>
  `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${path.replace(/^\//, '')}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [{ title: 'CADAM' }],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
  errorComponent: ({ error }) => (
    <RootDocument>
      <App error={error} />
    </RootDocument>
  ),
});

function RootComponent() {
  return (
    <RootDocument>
      <App />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <link
          rel="icon"
          type="image/svg+xml"
          href={assetUrl('cadam-icon.svg')}
        />
        <link
          rel="icon"
          type="image/x-icon"
          href={assetUrl('cadam-icon.ico')}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
