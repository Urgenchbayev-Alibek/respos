import { useLayoutEffect, useRef, type RefObject } from 'react';

const SETTLE_MS = 200;
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * Siblings close the gap as part of the same motion: when a stacked item enters or leaves, the others
 * glide to their new place instead of snapping (FLIP on `translate`, so it composes with the item's own
 * transform transition). Positions are layout positions, which in-flight transforms do not affect.
 */
export function useStackFlip(container: RefObject<HTMLElement | null>, ids: readonly number[]) {
  const tops = useRef(new Map<number, number>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const origin = root.getBoundingClientRect().top;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<number, number>();
    ids.forEach((id, index) => {
      const element = root.children[index];
      if (!(element instanceof HTMLElement)) return;
      const top = origin + element.offsetTop;
      next.set(id, top);
      const shift = (tops.current.get(id) ?? top) - top;
      if (shift === 0 || reduced || typeof element.animate !== 'function') return;
      element.animate([{ translate: `0 ${shift}px` }, { translate: '0 0' }], { duration: SETTLE_MS, easing: EASE_OUT });
    });
    tops.current = next;
  }, [container, ids]);
}
