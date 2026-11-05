import { BASE, plainNeighbors, type Variant } from './sim';

/** Held-out set: different mechanisms from the development set. */
export const VARIANTS: Record<string, Variant> = {
  'det-5': {
    ...BASE,
    id: 'det-5',
    // "Apply inputs in the order they arrive instead of sorting them first - it is faster."
    sameTickOrder: (batch) => batch,
  },
  'det-6': {
    ...BASE,
    id: 'det-6',
    // "Cache neighbour lists so the flood fill does less work."
    neighbors: (() => {
      const cache = new Map<number, number[]>();
      return (cell: number) => {
        let n = cache.get(cell);
        if (!n) { n = plainNeighbors(cell); cache.set(cell, n); }
        return n;
      };
    })(),
  },
  'det-7': {
    ...BASE,
    id: 'det-7',
    // "Roll a cosmetic sparkle seed for every drop using the shared generator."
    perDrop: (rng) => { rng(); },
  },
};
