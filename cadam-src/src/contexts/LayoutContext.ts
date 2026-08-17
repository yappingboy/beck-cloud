import { createContext, useContext } from 'react';

type LayoutContextValue = {
  isSidebarOpen: boolean;
};

export const LayoutContext = createContext<LayoutContextValue>({
  isSidebarOpen: true,
});

export function useLayoutContext() {
  return useContext(LayoutContext);
}
