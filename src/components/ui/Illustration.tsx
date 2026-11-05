import { useState } from 'react';

/**
 * Decorative artwork from `public/assets/forge/`. Always `alt=""` and `aria-hidden`: a nearby heading carries the
 * meaning, so assistive technology never announces it. Lazy-loaded, never animated, and removed from the page if it
 * fails to load, so the app is complete without any image.
 */
export type ForgeArt = 'hero-forge' | 'academy' | 'discovery' | 'battle-lab' | 'agents' | 'workflows' | 'game-dev' | 'research' | 'background-contours';

export const artUrl = (name: ForgeArt): string => `${import.meta.env.BASE_URL}assets/forge/${name}.svg`;

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
