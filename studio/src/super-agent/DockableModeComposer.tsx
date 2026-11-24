import { Button } from 'open-design-ui/button';
import { IconButton } from 'open-design-ui/icon-button';
import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, Ref, RefObject } from 'react';
import { useI18n } from '../i18n/I18n';
import { RemixIcon } from '../icons/RemixIcons';

type ComposerPosition = 'inline' | 'compact' | 'expanded';

export interface DockableComposerHandle {
  focus: () => void;
}

export function DockableModeComposer({ ref, scrollRef, mountEditor, focusEditor, preview, action, templateRevision }: {
  ref: Ref<DockableComposerHandle>;
  scrollRef: RefObject<HTMLDivElement | null>;
  mountEditor: (node: HTMLDivElement | null) => void;
  focusEditor: () => void;
  templateRevision: number;
  preview: string;
  action: ReactNode;
}) {
  const { t } = useI18n();
  const editorId = useId();
  const slotRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const resizeFrom = useRef<DOMRect | null>(null);
  const summaryRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [position, setPosition] = useState<ComposerPosition>('inline');

  const resizeDock = useCallback((next: 'compact' | 'expanded') => {
    resizeFrom.current = frameRef.current?.getBoundingClientRect() ?? null;
    setPosition(next);
  }, []);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const from = resizeFrom.current;
    resizeFrom.current = null;
    if (!frame?.animate || !from || position === 'inline'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const to = frame.getBoundingClientRect();
    if (to.width === from.width && to.height === from.height) return;
    // Animate measured heights so wrapped options and attached assets fit on every screen.
    const animation = frame.animate([
      { width: from.width + 'px', height: from.height + 'px' },
      { width: to.width + 'px', height: to.height + 'px' },
    ], { duration: 460, easing: 'cubic-bezier(0.24, 0.64, 0.24, 1)' });
    return () => {
      // Reversing an in-flight resize rejects its finished promise.
      void animation.finished.catch(() => {});
      animation.cancel();
    };
  }, [position]);

  useEffect(() => {
    const scroll = scrollRef.current;
    const slot = slotRef.current;
    if (!scroll || !slot) return;

    let lastScrollTop = scroll.scrollTop;
    const syncPosition = () => {
      if (!scroll.clientHeight) return;
      const scrolled = scroll.scrollTop !== lastScrollTop;
      lastScrollTop = scroll.scrollTop;
      const bounds = slot.getBoundingClientRect();
      const aboveViewport = scroll.scrollTop > 0 && bounds.bottom <= scroll.getBoundingClientRect().top;
      if (aboveViewport && slot.dataset.position === 'inline') {
        // Keep the gallery at the same scroll offset while its editor floats.
        slot.style.setProperty('--sa-composer-slot-height', bounds.height + 'px');
        restoreFocus.current = slot.contains(document.activeElement);
        setPosition('compact');
      } else if (!aboveViewport && slot.dataset.position !== 'inline') {
        restoreFocus.current = document.activeElement === summaryRef.current;
        setPosition('inline');
      } else if (aboveViewport && scrolled && slot.dataset.position === 'expanded') {
        restoreFocus.current = slot.contains(document.activeElement);
        resizeDock('compact');
      }
    };

    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(syncPosition) : null;
    observer?.observe(scroll);
    observer?.observe(slot);
    syncPosition();
    scroll.addEventListener('scroll', syncPosition, { passive: true });
    return () => {
      observer?.disconnect();
      scroll.removeEventListener('scroll', syncPosition);
    };
  }, [scrollRef, resizeDock]);

  useLayoutEffect(() => {
    if (position === 'expanded' || (position === 'inline' && restoreFocus.current)) {
      focusEditor();
    } else if (position === 'compact' && restoreFocus.current) {
      summaryRef.current?.focus({ preventScroll: true });
    }
    restoreFocus.current = false;
  }, [position, focusEditor]);

  useImperativeHandle(ref, () => ({
    focus() {
      if (position === 'compact') resizeDock('expanded');
      else focusEditor();
    },
  }), [focusEditor, position, resizeDock]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (position !== 'expanded' || !scroll) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || slotRef.current?.contains(target)) return;
      // Picking a template updates the open editor in place.
      if (!target.closest('[data-composer-source]')) resizeDock('compact');
    };
    scroll.addEventListener('pointerdown', onPointerDown);
    return () => scroll.removeEventListener('pointerdown', onPointerDown);
  }, [position, scrollRef, resizeDock]);

  const collapse = useCallback(() => {
    restoreFocus.current = true;
    resizeDock('compact');
  }, [resizeDock]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || position !== 'expanded') return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.defaultPrevented || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      for (let el = event.target as HTMLElement | null; el && el !== frame; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight && /^(auto|scroll)$/.test(getComputedStyle(el).overflowY)) return;
      }
      collapse();
    };
    frame.addEventListener('wheel', onWheel, { passive: true });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [collapse, position]);

  return (
    <div className="om-sa-dock-slot" ref={slotRef} data-position={position}>
      <div className="om-sa-dock-frame" ref={frameRef}>
        <div id={editorId} className="om-sa-dock-editor" inert={position === 'compact'} ref={mountEditor} />
        <Button variant="plain" type="button" className="om-sa-dock-summary" ref={summaryRef} inert={position !== 'compact'}
          aria-label={t('Expand') + ' · ' + t('Message Super Agent')} aria-expanded={false} aria-controls={editorId}
          onClick={() => resizeDock('expanded')}>
          <span>{preview}</span>
        </Button>
        {position === 'compact' && action}
        {templateRevision > 0 && <span key={templateRevision} className="om-sa-template-sweep" aria-hidden="true" />}
        {position === 'expanded' && (
          <IconButton variant="plain" type="button" className="om-sa-dock-fold" aria-label={t('Collapse')} title={t('Collapse')}
            aria-expanded={true} aria-controls={editorId} onClick={collapse}
            icon={<RemixIcon name="arrow-down-s-line" size={16} />} />
        )}
      </div>
    </div>
  );
}
