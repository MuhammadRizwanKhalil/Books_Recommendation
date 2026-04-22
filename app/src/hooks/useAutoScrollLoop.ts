import { RefObject, useEffect } from 'react';

type Params = {
  containerRef: RefObject<HTMLDivElement>;
  pauseRef: RefObject<boolean>;
  enabled: boolean;
  speed?: number;
};

/**
 * Smooth, robust auto-scrolling carousel loop.
 *
 * Fixes the "moves a bit then stops" symptom:
 *  - Fractional accumulator: sub-pixel speed (0.3px/frame) no longer truncates to 0.
 *  - Resets lastTime on resume so paused→active doesn't produce a huge delta jump.
 *  - Transient pause on user wheel / touchmove with auto-resume after 1.5s.
 *  - pointerleave / pointercancel fallback clears a stuck pauseRef.
 *  - rootMargin:'100px' keeps loop alive just outside viewport for smoother re-entry.
 */
export function useAutoScrollLoop({ containerRef, pauseRef, enabled, speed = 0.35 }: Params) {
  useEffect(() => {
    const el = containerRef.current;
    if (!enabled || !el) return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;

    let rafId = 0;
    let lastTime = 0;
    let acc = 0;
    let isInView = false;
    let isPageVisible = document.visibilityState === 'visible';
    let userScrollUntil = 0;

    const step = (time: number) => {
      if (!isInView || !isPageVisible) {
        rafId = 0;
        return;
      }

      const isPaused = pauseRef.current || time < userScrollUntil;

      if (isPaused) {
        lastTime = 0;
        acc = 0;
      } else {
        if (lastTime > 0) {
          const delta = Math.min(time - lastTime, 64);
          acc += speed * (delta / 16);
          if (acc >= 1) {
            const px = Math.floor(acc);
            acc -= px;
            el.scrollLeft += px;
            const halfWidth = el.scrollWidth / 2;
            if (halfWidth > 0 && el.scrollLeft >= halfWidth) {
              el.scrollLeft -= halfWidth;
            }
          }
        }
        lastTime = time;
      }

      rafId = requestAnimationFrame(step);
    };

    const start = () => {
      if (rafId === 0 && isInView && isPageVisible) {
        lastTime = 0;
        acc = 0;
        rafId = requestAnimationFrame(step);
      }
    };

    const stop = () => {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        isInView = entries.some((entry) => entry.isIntersecting);
        if (isInView) start();
        else stop();
      },
      { threshold: 0, rootMargin: '100px' },
    );
    observer.observe(el);

    const onVisibilityChange = () => {
      isPageVisible = document.visibilityState === 'visible';
      if (isPageVisible) start();
      else stop();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const bumpUserScroll = () => {
      userScrollUntil = performance.now() + 1500;
    };
    el.addEventListener('wheel', bumpUserScroll, { passive: true });
    el.addEventListener('touchmove', bumpUserScroll, { passive: true });

    const clearPause = () => {
      if (pauseRef.current) {
        (pauseRef as { current: boolean }).current = false;
      }
    };
    el.addEventListener('pointerleave', clearPause);
    el.addEventListener('pointercancel', clearPause);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      el.removeEventListener('wheel', bumpUserScroll);
      el.removeEventListener('touchmove', bumpUserScroll);
      el.removeEventListener('pointerleave', clearPause);
      el.removeEventListener('pointercancel', clearPause);
      observer.disconnect();
      stop();
    };
  }, [containerRef, enabled, pauseRef, speed]);
}
