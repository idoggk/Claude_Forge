import { useState } from 'react';

/**
 * Decorative artwork from `public/assets/forge/`. Always `alt=""` and `aria-hidden`: a nearby heading carries the
 * meaning, so assistive technology never announces it. Lazy-loaded, never animated, and removed from the page if it
 * fails to load, so the app is complete without any image.
 */
export type ForgeArt = 'hero-forge' | 'academy' | 'discovery' | 'battle-lab' | 'agents' | 'workflows' | 'game-dev' | 'research' | 'background-contours';

export const artUrl = (name: ForgeArt): string => `${import.meta.env.BASE_URL}assets/forge/${name}.svg`;

/** The home visual pack (public/assets/forge-home): a wide hero, four learning-path pictures, a lab picture and a backdrop. */
export type HomeArt = 'hero-forge-wide' | 'track-ai-engineering' | 'track-game-development' | 'track-agents-automation' | 'track-research' | 'track-ai-lab' | 'background-contours';
export const homeArtUrl = (name: HomeArt): string => `${import.meta.env.BASE_URL}assets/forge-home/${name}.svg`;

export function Illustration({ name, className }: { name: ForgeArt; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={artUrl(name)}
      alt=""
      aria-hidden="true"
      width={960}
      height={560}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={['forge-art block h-auto w-full rounded-xl border border-line object-cover', className].filter(Boolean).join(' ')}
    />
  );
}

/**
 * A picture from the home pack. Decorative: empty alt, hidden from assistive technology, never focusable, lazy so a phone that
 * hides it does not download it, and removed if it fails to load. `className` controls size and cropping.
 */
export function HomeImage({ name, className, width, height }: { name: HomeArt; className?: string; width: number; height: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={homeArtUrl(name)} alt="" aria-hidden="true" width={width} height={height} loading="lazy" decoding="async" draggable={false} tabIndex={-1} onError={() => setFailed(true)} className={['pointer-events-none select-none', className].filter(Boolean).join(' ')} />;
}
