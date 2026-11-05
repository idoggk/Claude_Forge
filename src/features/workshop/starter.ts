import { SkillContentSchema, type SkillContent } from '@/domain/skills/model';
import { newId } from '@/lib/ids';

/** An editable example, clearly a starting point. */
export function starterContent(): SkillContent {
  return SkillContentSchema.parse({
    name: 'merge-chain-debugger',
    description:
      'Debugs merge-board cascade failures in a puzzle game: pieces that vanish, scores that differ after chain merges, seeded simulations that diverge. Use when investigating merge or cascade bugs. Not for general refactoring, UI styling or balance tuning.',
    instructions: `# Merge chain debugger

1. Reproduce the failure with a seeded run. Note the seed and the first failing drop number.
2. State the violated invariant in one sentence (for example: total board value is not conserved by merges).
3. Minimise the board to the smallest case that still fails.
4. Find the code that decides the violating behaviour and make the smallest change that makes the code state the rule.
5. Run the full test suite and the seeded scan. Report the exact commands and their output. Do not claim success without output.
6. Add the minimal reproduction as a regression test.

Read [the invariants](references/invariants.md) before editing merge rules.`,
    useCases: ['A cascade loses a piece or value', 'A seeded playthrough diverges from the expected score'],
    nonUseCases: ['Renaming or restructuring code', 'Balance tuning (use an economy Skill)'],
    references: [{ path: 'references/invariants.md', content: '# Merge board invariants\n\n- A drop adds exactly the dropped piece\'s value (value = 3^rank).\n- After resolution no group of 3+ equal pieces remains below max rank.\n- Each merge consumes exactly 3 pieces.\n' }],
    scenarios: [
      { id: newId('sc'), prompt: 'My merge cascade loses a piece after a chain of merges', expected: 'activate', note: '' },
      { id: newId('sc'), prompt: 'Seed 7 diverges from the expected score after chain merges', expected: 'activate', note: '' },
      { id: newId('sc'), prompt: 'Rename the variables in the board file to be clearer', expected: 'not-activate', note: 'Near-miss: same files, different job' },
      { id: newId('sc'), prompt: 'Make the shop screen buttons larger on mobile', expected: 'not-activate', note: '' },
      { id: newId('sc'), prompt: 'Something is wrong with the board', expected: 'ambiguous', note: 'Decide whether vague complaints should trigger' },
    ],
  });
}
