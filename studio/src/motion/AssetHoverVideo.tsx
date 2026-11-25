import { useEffect, useRef, useState } from 'react';
import { useSkillPreview } from './useSkillPreview';

/** A temporary, silent player layered over the retained gallery poster. */
export function AssetHoverVideo({ src, className = 'om-asset-hover-video' }: { src: string; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false), [failed, setFailed] = useState(false);
  const videoSource = useSkillPreview(src, !failed, setFailed);
  useEffect(() => {
    const element = video.current;
    if (!element || !videoSource || failed) return;
    let cancelled = false;
    const unavailable = () => { if (!cancelled) setFailed(true); };
    const timeout = window.setTimeout(unavailable, 15000);
    const ready = () => window.clearTimeout(timeout);
    element.addEventListener('playing', ready);
    element.muted = true;
    element.src = videoSource;
    void element.play().catch(unavailable);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      element.removeEventListener('playing', ready);
      element.pause();
      element.removeAttribute('src');
      element.load();
    };
  }, [videoSource, failed]);
  return <video ref={video} className={className} muted loop playsInline preload="none" aria-hidden="true"
    data-playing={playing && !failed || undefined}
    style={{ visibility: playing && !failed ? 'visible' : 'hidden' }}
    onPlaying={() => setPlaying(true)} onError={() => setFailed(true)} />;
}
