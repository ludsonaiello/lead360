'use client';

import { useEffect } from 'react';

/**
 * Sets `document.title` for client components (pages inside the dashboard
 * shell are all `'use client'`, so Next.js `metadata` export cannot be used).
 *
 * The previous title is restored on unmount so that fast navigations between
 * routes never flash a stale title.
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export default usePageTitle;
