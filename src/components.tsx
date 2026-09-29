import { useEffect, useRef, useState } from 'react';
import type { Token } from './chain';

/** The renderer's viewBox is 24×24. Never stretch to a fractional pixel scale. */
export function PixelArt({ token, hero = false }: { token: Token; hero?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(24);
  useEffect(() => {
    if (!container.current) return;
    const element = container.current;
    const resize = () => {
      const available = element.clientWidth;
      setSize(Math.max(24, Math.floor(Math.min(available, hero ? 384 : 240) / 24) * 24));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [hero]);
  return <div className={`art-stage ${hero ? 'hero-art-stage' : ''}`} ref={container}>
    <img src={token.image} alt={`Swarm Pepe #${token.id}${token.revealed ? '' : ' — pending reveal'}`} width={size} height={size} decoding="async" loading={hero ? 'eager' : 'lazy'} />
  </div>;
}

export function ExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className={className}>{children}<span aria-hidden="true"> ↗</span><span className="sr-only"> (opens in a new tab)</span></a>;
}
