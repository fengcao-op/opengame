// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import repositoryMedia from '../../../../repository-media.json';
import type { GameCard } from '../../../../shared/game-contract';
import { GameMasonry } from './GameMasonry';

function expectedPreviewSrc(id: string) {
  const entry = repositoryMedia.files.find(file => file.path === `library/game-previews/${id}.mp4`);
  return entry?.url ?? `/game-preview-drafts/${id}.mp4`;
}

it('keeps the hovered highlight playing through scroll and releases it on exit or backgrounding', async () => {
  const games = [
    { id: 'castle-crush', source: 'template', orientation: 'portrait' },
    { id: 'community-what-the-water-keeps', source: 'community' },
    { id: 'no-clip', source: 'template' },
  ] as GameCard[];
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const oldActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const hitTest = vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const motion = vi.spyOn(window, 'matchMedia');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const matches = vi.spyOn(reduced, 'matches', 'get').mockReturnValue(false);
  motion.mockReturnValue(reduced);
  const card = (id: string) => container.querySelector<HTMLElement>(`[data-game-preview-id="${id}"]`)!;
  const video = () => container.querySelector('video');
  const hover = async (id: string, pointerType = 'mouse') => act(async () => {
    card(id).dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType }));
    vi.advanceTimersByTime(250);
  });
  const scrollTo = async (target: Element) => act(async () => {
    hitTest.mockReturnValue(target);
    container.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(20);
  });

  try {
    await act(async () => root.render(<GameMasonry games={games} render={(game, _aspectRatio, preview) => (
      <article key={game.id} data-game-preview-id={game.id}><img alt="" />{preview}</article>
    )} />));
    await hover('no-clip');
    await hover('castle-crush', 'touch');
    expect(video()).toBeNull();
    expect(play).not.toHaveBeenCalled();

    const poster = card('castle-crush').querySelector('img');
    await hover('castle-crush');
    const first = video()!;
    expect(first.getAttribute('src')).toBe(expectedPreviewSrc('castle-crush'));
    expect(first.muted && first.loop && first.hasAttribute('playsinline')).toBe(true);
    expect(first.style.visibility).toBe('hidden');
    await act(async () => first.dispatchEvent(new Event('playing')));
    expect(first.style.visibility).toBe('visible');
    expect(card('castle-crush').querySelector('img')).toBe(poster);

    await act(async () => card('castle-crush').dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, pointerType: 'mouse', clientX: 100, clientY: 120,
    })));
    await scrollTo(poster!);
    expect(hitTest).toHaveBeenLastCalledWith(100, 120);
    expect(video()).toBe(first);
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();

    await scrollTo(card('community-what-the-water-keeps'));
    expect(video()).toBeNull();
    await act(async () => vi.advanceTimersByTime(250));
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(pause.mock.instances).toContain(first);
    expect(first.getAttribute('src')).toBeNull();
    expect(video()?.getAttribute('src')).toBe(expectedPreviewSrc('community-what-the-water-keeps'));
    await scrollTo(container);
    expect(video()).toBeNull();

    await hover('community-what-the-water-keeps');
    await act(async () => card('community-what-the-water-keeps').dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: document.body })));
    expect(video()).toBeNull();

    await hover('community-what-the-water-keeps');
    hidden.mockReturnValue(true);
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(video()).toBeNull();

    hidden.mockReturnValue(false);
    matches.mockReturnValue(true);
    await hover('community-what-the-water-keeps');
    expect(video()).toBeNull();

    matches.mockReturnValue(false);
    await hover('castle-crush');
    const failed = video()!;
    await act(async () => failed.dispatchEvent(new Event('error')));
    expect(failed.style.visibility).toBe('hidden');
    expect(failed.getAttribute('src')).toBeNull();
    expect(card('castle-crush').querySelector('img')).toBe(poster);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    for (const spy of [play, pause, load, hitTest, hidden, motion, matches]) spy.mockRestore();
    vi.useRealTimers();
    globalThis.IS_REACT_ACT_ENVIRONMENT = oldActEnvironment;
  }
});
