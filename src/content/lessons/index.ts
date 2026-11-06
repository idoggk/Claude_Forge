import type { Item, Lesson } from '@/domain/curriculum/types';
import { L01 } from './l01';
import { L02 } from './l02';
import { L03 } from './l03';
import { L04 } from './l04';
import { L05 } from './l05';
import { L06 } from './l06';
import { L07 } from './l07';
import { L08 } from './l08';
import { L09 } from './l09';
import { L10 } from './l10';
import { L11 } from './l11';
import { L12 } from './l12';
import { L13 } from './l13';
import { L14 } from './l14';
import { L15 } from './l15';
import { L16 } from './l16';
import { L17 } from './l17';
import { L18 } from './l18';
import { L19 } from './l19';
import { L20 } from './l20';
import { L21 } from './l21';
import { L22 } from './l22';
import { L23 } from './l23';
import { L24 } from './l24';
import { EXTRA_REVIEW_ITEMS } from './review-extra';
import { REVIEW_POOL_2 } from './review-pool-2';

/**
 * Difficulty of the original 5 review items per lesson (1 recall, 2 apply, 3 judge). The 4 newer items per lesson
 * carry their own `difficulty`. Pools hold 9 items so spaced reviews rotate and can be paced and targeted.
 */
const LEGACY_DIFFICULTY: Record<string, 1 | 2 | 3> = {
  'l01-r1': 2, 'l01-r2': 2, 'l01-r3': 3, 'l01-r4': 1, 'l01-r5': 1,
  'l02-r1': 1, 'l02-r2': 1, 'l02-r3': 2, 'l02-r4': 2, 'l02-r5': 3,
  'l03-r1': 1, 'l03-r2': 2, 'l03-r3': 2, 'l03-r4': 3, 'l03-r5': 3,
  'l04-r1': 2, 'l04-r2': 2, 'l04-r3': 2, 'l04-r4': 3, 'l04-r5': 2,
  'l05-r1': 1, 'l05-r2': 1, 'l05-r3': 2, 'l05-r4': 1, 'l05-r5': 2,
  'l06-r1': 1, 'l06-r2': 2, 'l06-r3': 3, 'l06-r4': 2, 'l06-r5': 1,
  'l07-r1': 1, 'l07-r2': 2, 'l07-r3': 3, 'l07-r4': 1, 'l07-r5': 3,
  'l08-r1': 2, 'l08-r2': 2, 'l08-r3': 2, 'l08-r4': 3, 'l08-r5': 2,
  'l09-r1': 1, 'l09-r2': 2, 'l09-r3': 3, 'l09-r4': 1, 'l09-r5': 2,
  'l10-r1': 2, 'l10-r2': 1, 'l10-r3': 2, 'l10-r4': 3, 'l10-r5': 1,
};
const withDifficulty = (it: Item): Item => (it.difficulty ? it : { ...it, difficulty: LEGACY_DIFFICULTY[it.id] ?? 2 });
const withReviewPool = (l: Lesson): Lesson => ({
  ...l,
  reviewItems: [...l.reviewItems, ...(EXTRA_REVIEW_ITEMS[l.id] ?? []), ...(REVIEW_POOL_2[l.id] ?? [])].map(withDifficulty),
});

export const LESSONS: Lesson[] = [L01, L02, L03, L04, L05, L06, L07, L08, L09, L10, L11, L12, L13, L14, L15, L16, L17, L18, L19, L20, L21, L22, L23, L24].map(withReviewPool).sort((a, b) => a.order - b.order);

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
