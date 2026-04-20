import { RefObject, useEffect } from 'react';

type Params = {
  containerRef: RefObject<HTMLDivElement>;
  pauseRef: RefObject<boolean>;
  enabled: boolean;
  speed?: number;
};

export function useAutoScrollLoop({ containerRef, pauseRef, enabled, speed = 0.35 }: Params) {
  useEffect(() => {
    const el = containerRef.current;
    if (!enabled || !el) return;

    // Respect users who prefer reduced motion.
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;

    let rafId = 0;
    let lastTime = 0;
    let isInView = false;
    let isPageVisible = document.visibilityState === 'visible';

    const step = (time: number) => {
      if (!isInView || !isPageVisible) {
        rafId = 0;
        return;
      }

      if (!pauseRef.current && lastTime > 0) {
        const delta = time - lastTime;
        el.scrollLeft += speed * (delta / 16);

        const halfWidth = el.scrollWidth / 2;
        if (halfWidth > 0 && el.scrollLeft >= halfWidth) {
          el.scrollLeft -= halfWidth;
        }
      }

      lastTime = time;
      rafId = requestAnimationFrame(step);
    };

    const start = () => {
      if (rafId === 0 && isInView && isPageVisible) {
        lastTime = 0;
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
        if (isInView) {
          start();
        } else {
          stop();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);

    const onVisibilityChange = () => {
      isPageVisible = document.visibilityState === 'visible';
      if (isPageVisible) {
        start();
      } else {
        stop();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      observer.disconnect();
      stop();
    };
  }, [containerRef, enabled, pauseRef, speed]);
}
