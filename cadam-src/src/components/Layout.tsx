import { useEffect, useState } from 'react';
import { Outlet, useLocation } from '@tanstack/react-router';
import { PanelLeft } from 'lucide-react';

import { Sidebar } from './Sidebar';
import { CreditsButton } from './CreditsButton';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Loader2 } from 'lucide-react';
import { LayoutContext } from '@/contexts/LayoutContext';

export function Layout() {
  const { user, isLoading } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hasLoadedSidebarPreference, setHasLoadedSidebarPreference] =
    useState(false);

  useEffect(() => {
    const storedSidebarPreference = localStorage.getItem('sidebarOpen');

    if (storedSidebarPreference !== null) {
      setIsSidebarOpen(storedSidebarPreference !== 'false');
    }

    setHasLoadedSidebarPreference(true);
  }, []);

  useEffect(() => {
    if (hasLoadedSidebarPreference) {
      localStorage.setItem('sidebarOpen', isSidebarOpen.toString());
    }
  }, [hasLoadedSidebarPreference, isSidebarOpen]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-adam-bg-secondary-dark">
        <Loader2 className="h-8 w-8 animate-spin text-adam-blue" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-dvh overflow-hidden">
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        />
        <LayoutContext.Provider value={{ isSidebarOpen }}>
          <Outlet />
        </LayoutContext.Provider>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden">
      <div className="flex h-dvh transition-all ease-in-out">
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        />
        <div className="relative flex-1 overflow-auto bg-adam-bg-dark">
          {/* Credits button — home page only. Mirrors the sidebar-toggle's
              movement: eases inward when the sidebar opens (so it lands
              inside the rounded panel) and back to the edge when it closes.
              The `!user` branch above returns early, so no `user` guard here. */}
          {location.pathname === '/' && (
            <div
              className={`absolute z-20 flex items-center gap-2 transition-all duration-300 ease-in-out ${
                isSidebarOpen && !isMobile
                  ? 'right-[2.25rem] top-[2.25rem]'
                  : 'right-3.5 top-3.5'
              }`}
            >
              <CreditsButton />
            </div>
          )}
          {/* Toggle Sidebar Button - Positioned on main content area */}
          {!isMobile && user && (
            <Button
              variant="ghost"
              size="icon"
              className={`bg-adam-neutral-3000 fixed z-10 h-7 w-7 rounded-md text-gray-400 transition-all duration-300 [@media(hover:hover)]:hover:bg-adam-neutral-950 [@media(hover:hover)]:hover:text-adam-neutral-10 ${
                isSidebarOpen ? 'left-[272px]' : 'left-20'
              } ${
                location.pathname === '/' && isSidebarOpen
                  ? 'top-[2.25rem]'
                  : 'top-3.5'
              }`}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="h-full bg-adam-bg-dark">
            <LayoutContext.Provider value={{ isSidebarOpen }}>
              <Outlet />
            </LayoutContext.Provider>
          </div>
        </div>
      </div>
    </div>
  );
}
