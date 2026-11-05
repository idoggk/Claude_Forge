import { BASE, plainNeighbors, type Variant } from './sim';

/** Development set: the code change behind each proposal, expressed as the behaviour it alters. */
export const VARIANTS: Record<string, Variant> = {
  'det-1': {
    ...BASE,
    id: 'det-1',
    // "Make bonus spawns feel less predictable."
    pickSpawn: (empties) => empties[Math.floor(Math.random() * empties.length)]!,
  },
  'det-2': {
    ...BASE,
    id: 'det-2',
    // "Extract the neighbour lookup into a helper and return early on the board edge."
    neighbors: (cell) => plainNeighbors(cell),
  },
  'det-3': {
    ...BASE,
    id: 'det-3',
    // "Spawn the bonus piece before merges resolve so players see it sooner."
    spawnFirst: true,
  },
  'det-4': {
    ...BASE,
    id: 'det-4',
    // "Break merge ties with the clock so ties alternate and feel fair."
    tieBreak: (a, b) => (Date.now() % 2 === 0 ? Math.min(...a.cells) - Math.min(...b.cells) : Math.min(...b.cells) - Math.min(...a.cells)),
  },
};
