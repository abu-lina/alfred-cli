import { useState, useCallback } from 'react';

export type Route =
  | { type: 'inbox' }
  | { type: 'board' }
  | { type: 'standup' }
  | { type: 'tasks'; repo: string; issue: number };

export interface Navigation {
  view: Route;
  canGoBack: boolean;
  push: (route: Route) => void;
  back: () => void;
  navigateTo: (route: Route) => void;
}

export function useNavigation(): Navigation {
  const [stack, setStack] = useState<Route[]>([{ type: 'board' }]);

  const push = useCallback((route: Route) => {
    setStack(prev => [...prev, route]);
  }, []);

  const back = useCallback(() => {
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const navigateTo = useCallback((route: Route) => {
    setStack([route]);
  }, []);

  return {
    view: stack[stack.length - 1]!,
    canGoBack: stack.length > 1,
    push,
    back,
    navigateTo,
  };
}
