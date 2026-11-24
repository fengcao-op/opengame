import { IconButton } from 'open-design-ui/icon-button';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18n';
import { RemixIcon } from '../icons/RemixIcons';

type SlideControls = { centered: boolean; playing: boolean; bringToFront: () => void };

export function ShowcaseCarousel<T extends { id: string }>({
  items, label, active, children,
}: {
  items: readonly T[];
  label: string;
  active: boolean;
  children: (item: T, controls: SlideControls) => ReactNode;
}) {
  const { t } = useI18n();
  const region = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [canAnimate, setCanAnimate] = useState(false);
  const count = items.length;

  useEffect(() => {
    const element = region.current;
    if (!element || !active) return;
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let visible = typeof IntersectionObserver === 'undefined';
    const update = () => setCanAnimate(visible && !document.hidden && !preference?.matches);
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      update();
    }) : undefined;
    observer?.observe(element);
    update();
    document.addEventListener('visibilitychange', update);
    preference?.addEventListener?.('change', update);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
      preference?.removeEventListener?.('change', update);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !canAnimate || hovered || focused || count < 2) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % count), 4500);
    return () => window.clearInterval(timer);
  }, [active, canAnimate, hovered, focused, count]);

  function move(by: number) {
    setIndex(i => (i + count + by) % count);
  }

  function navigation(side: 'prev' | 'next') {
    const previous = side === 'prev';
    return count > 1 && (
      <IconButton variant="plain" type="button" className="om-sa-game-fan-nav" data-side={side}
        aria-label={t(previous ? 'Previous' : 'Next')} onClick={() => move(previous ? -1 : 1)}
        icon={<RemixIcon name={previous ? 'arrow-left-line' : 'arrow-right-line'} size={16} />} />
    );
  }

  const firstOffset = -Math.min(3, Math.floor((count - 1) / 2));
  return (
    <div ref={region} className="om-sa-game-fan" role="region" aria-roledescription="carousel" aria-label={label}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={event => {
        if (count < 2 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
        event.preventDefault();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      }}
    >
      {navigation('prev')}
      {Array.from({ length: Math.min(count, 7) }, (_, position) => {
        const offset = firstOffset + position;
        const itemIndex = (index + offset + count) % count;
        const item = items[itemIndex]!;
        const centered = offset === 0;
        const hidden = Math.abs(offset) > 2;
        return (
          <div key={item.id} className="om-sa-game-fan-item" data-slot={offset} data-center={centered || undefined}
            aria-hidden={hidden || undefined} inert={hidden || undefined}>
            {children(item, { centered, playing: centered && active && canAnimate, bringToFront: () => setIndex(itemIndex) })}
          </div>
        );
      })}
      {navigation('next')}
    </div>
  );
}
