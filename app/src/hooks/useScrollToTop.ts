import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to scroll to top on mount or on specified dependencies
 * 
 * Usage:
 *   - Auto-scroll on pathname change (if no deps):
 *     useScrollToTop()
 *   - Scroll when specific value changes:
 *     useScrollToTop([bookId])
 * 
 * @param deps Optional dependency array. If not provided, scrolls when pathname changes
 * @param behavior 'auto' (instant) or 'smooth' (animated). Default: 'smooth'
 */
export function useScrollToTop(deps?: unknown[], behavior: 'auto' | 'smooth' = 'smooth') {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior });
  }, deps ? deps : [location.pathname]);
}
