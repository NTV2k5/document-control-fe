import { createRouter } from '@tanstack/react-router';
import { NotFound } from './components/ui/not-found';
import { routeTree } from './routeTree.gen';


function DefaultPending() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white gap-6">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-[#002147] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function DefaultNotFound() {
  return <NotFound />;
}

export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultPendingComponent: DefaultPending,
    defaultNotFoundComponent: DefaultNotFound,
  });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
