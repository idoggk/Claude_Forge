import type { ReactNode } from 'react';
import { HomeImage } from '@/components/ui';

/**
 * The compact banner at the top of Home. The artwork is a dark panel, so the banner is dark in BOTH themes and its text uses fixed
 * light colours that keep their contrast whether or not the picture loads (the fallback colour is the picture's own dark). The picture
 * is decorative and hidden on small screens; the heading, the status line and the actions carry everything.
 */
export function HomeHero({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section aria-labelledby="home-h" className="relative mb-5 overflow-hidden rounded-2xl border border-line bg-[#0e1a24] text-[#eaf2f7]" data-testid="home-hero">
      <div className="absolute inset-0 hidden md:block" aria-hidden="true"><HomeImage name="hero-forge-wide" width={1200} height={420} className="h-full w-full object-cover object-right" /></div>
      <div className="relative z-10 p-5 sm:p-7 md:max-w-[62%] lg:max-w-[58%]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#f2b85b]">{eyebrow}</p>
        <h1 id="home-h" className="mt-1 text-2xl font-semibold sm:text-3xl">{title}</h1>
        <div className="mt-2 text-[0.95rem] leading-relaxed text-[#c3d1dc]">{children}</div>
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}
