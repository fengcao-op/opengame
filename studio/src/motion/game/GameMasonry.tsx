import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { GameCard } from '../../../../shared/game-contract';
import repositoryMedia from '../../../../repository-media.json';
import { AssetHoverVideo } from '../AssetHoverVideo';

const previewDirectory = 'library/game-previews/';
const hostedPreviews = new Map(repositoryMedia.files.filter(file => file.path.startsWith(previewDirectory)).map(file => [file.path, file.url]));
const draftPreviews = import.meta.env.DEV
  ? new Set(Object.keys(import.meta.glob('../../../../library/game-previews/*.mp4')))
  : undefined;

function gamePreviewUrl(id: string) {
  const filename = `${id}.mp4`;
  const path = previewDirectory + filename;
  return hostedPreviews.get(path) ?? (draftPreviews?.has(`../../../../${path}`) ? `/game-preview-drafts/${filename}` : undefined);
}

function gameCardAt(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>('[data-game-preview-id]') : null;
}

/** Spreads portrait games through the list (one after every two landscape games) so both orientations show up together. */
export function interleavePortrait(list: GameCard[]): GameCard[] {
  const portrait = list.filter(game => game.orientation === 'portrait');
  const others = list.filter(game => game.orientation !== 'portrait');
  if (!portrait.length || !others.length) return list;
  const mixed: GameCard[] = [];
  others.forEach((game, index) => {
    mixed.push(game);
    if (index % 2 === 1 && portrait.length) mixed.push(portrait.shift()!);
  });
  return [...mixed, ...portrait];
}

function getCoverAspectRatio(game: GameCard) {
  return game.orientation === 'portrait' ? 3 / 4 : 16 / 9;
}

/** Places each cover in the shortest column using its declared game orientation. */
export function GameMasonry({
  games,
  render,
  active = true,
  minColumn = 260,
  gap = 12,
  className = 'om-game-masonry',
  columnClassName = 'om-game-masonry-column',
}: {
  games: GameCard[];
  render: (game: GameCard, coverAspectRatio: number, preview: ReactNode) => ReactNode;
  active?: boolean;
  minColumn?: number;
  gap?: number;
  className?: string;
  columnClassName?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [previewId, setPreviewId] = useState<string>();
  const pointer = useRef<{ x: number; y: number } | undefined>(undefined);
  const hoveredId = useRef<string | undefined>(undefined);
  const hoverTimer = useRef<number | undefined>(undefined);
  const stopPreview = useCallback(() => {
    hoveredId.current = undefined;
    window.clearTimeout(hoverTimer.current);
    setPreviewId(undefined);
  }, []);
  const resetHover = useCallback(() => {
    pointer.current = undefined;
    stopPreview();
  }, [stopPreview]);

  const syncHoveredCard = useCallback((card: HTMLElement | null) => {
    const id = card && box.current?.contains(card) ? card.dataset.gamePreviewId : undefined;
    if (id === hoveredId.current) return;
    stopPreview();
    if (!active || !id || !gamePreviewUrl(id) || document.hidden
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    hoveredId.current = id;
    hoverTimer.current = window.setTimeout(() => {
      if (box.current?.contains(card)) setPreviewId(id);
    }, 220);
  }, [active, stopPreview]);

  const rememberPointer = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return false;
    pointer.current = { x: event.clientX, y: event.clientY };
    return true;
  };

  useEffect(() => {
    if (!active) {
      resetHover();
      return;
    }
    let scrollFrame: number | undefined;
    const checkAfterScroll = () => {
      if (scrollFrame !== undefined || !pointer.current) return;
      // Scrolling can move cards under a stationary pointer without a pointer event.
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = undefined;
        const position = pointer.current;
        if (position) syncHoveredCard(gameCardAt(document.elementFromPoint(position.x, position.y)));
      });
    };
    const stopWhenHidden = () => { if (document.hidden) resetHover(); };
    document.addEventListener('visibilitychange', stopWhenHidden);
    document.addEventListener('scroll', checkAfterScroll, true);
    window.addEventListener('blur', resetHover);
    return () => {
      window.clearTimeout(hoverTimer.current);
      if (scrollFrame !== undefined) window.cancelAnimationFrame(scrollFrame);
      document.removeEventListener('visibilitychange', stopWhenHidden);
      document.removeEventListener('scroll', checkAfterScroll, true);
      window.removeEventListener('blur', resetHover);
    };
  }, [active, resetHover, syncHoveredCard]);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => {
      const next = element.clientWidth;
      if (next > 0) setWidth(prev => (prev === next ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect.width ?? element.clientWidth;
      if (next > 0) setWidth(prev => (prev === next ? prev : next));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const count = Math.max(1, Math.floor(((width || minColumn * 2) + gap) / (minColumn + gap)));
  const columns = useMemo(() => {
    const column = width ? (width - gap * (count - 1)) / count : minColumn;
    const lists: GameCard[][] = Array.from({ length: count }, () => []);
    const heights = Array(count).fill(0) as number[];
    for (const game of games) {
      const shortest = heights.indexOf(Math.min(...heights));
      lists[shortest].push(game);
      heights[shortest] += column / getCoverAspectRatio(game) + gap;
    }
    return lists;
  }, [games, count, width, minColumn, gap]);

  return (
    <div
      ref={box}
      className={className}
      onPointerOver={event => {
        if (rememberPointer(event)) syncHoveredCard(gameCardAt(event.target));
      }}
      onPointerMove={rememberPointer}
      onPointerOut={event => {
        if (event.pointerType === 'touch') return;
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) {
          syncHoveredCard(gameCardAt(next));
        } else {
          resetHover();
        }
      }}
      onPointerCancel={resetHover}
      onClickCapture={resetHover}
    >
      {columns.map((list, index) => (
        <div key={index} className={columnClassName}>
          {list.map(game => {
            const src = active && game.source !== 'mine' && previewId === game.id
              ? gamePreviewUrl(game.id)
              : undefined;
            return render(game, getCoverAspectRatio(game), src && (
              <AssetHoverVideo
                src={src}
                className="pointer-events-none absolute inset-0 block h-full w-full object-cover"
              />
            ));
          })}
        </div>
      ))}
    </div>
  );
}
