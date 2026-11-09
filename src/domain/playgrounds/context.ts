/**
 * Playground A: context engineering. A rule-based, explainable demonstration of what goes into a brief and what that does
 * to a model's chances. It is NOT a model and it does not predict one: it has no accuracy numbers because nothing here
 * measures accuracy. It shows the reasoning: missing information forces a guess, noise competes with the constraint, a
 * contradicting source pulls two ways, and a budget forces a choice. Token counts are estimates (words times 1.3) against a
 * fictional budget. Everything is deterministic.
 */
export type CardRole = 'needed' | 'constraint' | 'acceptance' | 'helpful' | 'noise' | 'conflict';
export interface ContextCard { id: string; title: string; detail: string; tokens: number; role: CardRole }

export const TASK = {
  title: 'Fix payout()',
  brief: 'Fix `payout()` so that a refund is never paid twice. Do not change the save format. It is done when `payout.test.ts` passes and `save-format.test.ts` is unchanged.',
  budget: 800,
};

export const CARDS: ContextCard[] = [
  { id: 'code', title: 'The payout() source', detail: 'About 80 lines: the function that is being fixed.', tokens: 120, role: 'needed' },
  { id: 'failure', title: 'The failing test output', detail: 'payout.test.ts: a refund is paid twice for one order.', tokens: 40, role: 'needed' },
  { id: 'constraint', title: 'Constraint: do not change the save format', detail: 'One line stating what must stay the same.', tokens: 12, role: 'constraint' },
  { id: 'acceptance', title: 'Acceptance check', detail: 'payout.test.ts passes; save-format.test.ts is unchanged.', tokens: 20, role: 'acceptance' },
  { id: 'policy', title: 'The refundPolicy() source', detail: 'About 20 lines: a helper payout() calls.', tokens: 50, role: 'helpful' },
  { id: 'history', title: 'Three years of design meeting notes', detail: 'True and interesting, but nothing here changes the fix.', tokens: 400, role: 'noise' },
  { id: 'styleguide', title: 'The whole company style guide', detail: 'Thirty pages of naming and formatting rules.', tokens: 600, role: 'noise' },
  { id: 'audio', title: 'The audio engine source', detail: 'About 2,000 lines in an unrelated part of the game.', tokens: 900, role: 'noise' },
  { id: 'oldplan', title: 'Last quarter\'s plan (superseded)', detail: 'Says: "migrate the save format to version 2 while fixing payouts".', tokens: 150, role: 'conflict' },
];

export type Placement = 'first' | 'last';
export interface ContextState { included: string[]; constraintPlacement: Placement }
export type Tone = 'ok' | 'warn' | 'bad' | 'info';
export interface Effect { id: string; tone: Tone; text: string }
export interface ContextReading {
  tokens: number;
  budget: number;
  overBudget: boolean;
  noiseShare: number;
  /** Estimated tokens that sit ahead of the constraint in the brief. */
  tokensBeforeConstraint: number;
  effects: Effect[];
  sufficient: boolean;
}

const byId = new Map(CARDS.map((c) => [c.id, c]));
export const emptyState = (): ContextState => ({ included: [], constraintPlacement: 'last' });

export function assessContext(s: ContextState): ContextReading {
  const inc = new Set(s.included.filter((id) => byId.has(id)));
  const cards = CARDS.filter((c) => inc.has(c.id));
  const tokens = cards.reduce((n, c) => n + c.tokens, 0);
  const noiseTokens = cards.filter((c) => c.role === 'noise' || c.role === 'conflict').reduce((n, c) => n + c.tokens, 0);
  const noiseShare = tokens === 0 ? 0 : noiseTokens / tokens;
  // Order: the constraint goes first or last; everything else keeps the listed order.
  const others = cards.filter((c) => c.id !== 'constraint');
  const before = inc.has('constraint') ? (s.constraintPlacement === 'first' ? 0 : others.reduce((n, c) => n + c.tokens, 0)) : 0;
  const effects: Effect[] = [];
  const e = (id: string, tone: Tone, text: string) => effects.push({ id, tone, text });

  if (!inc.has('code')) e('no-code', 'bad', 'The function to fix is not in the brief, so the model would have to guess what it looks like.');
  if (!inc.has('failure')) e('no-failure', 'bad', 'There is no failing output, so the model cannot see what "paid twice" means in practice.');
  if (!inc.has('constraint')) e('no-constraint', 'bad', 'Nothing says the save format must stay the same. A fix that changes it would look reasonable to the model.');
  if (!inc.has('acceptance')) e('no-acceptance', 'warn', 'There is no acceptance check, so neither the model nor you has a way to tell when the work is done.');
  if (inc.has('oldplan')) e('conflict', 'bad', 'The superseded plan contradicts the constraint. The brief now points two ways, and the model may follow either one.');
  if (inc.has('constraint') && before >= 300) e('buried', 'warn', `The constraint comes after about ${before} tokens of other material. It is present but easy to lose. Move it to the top or cut what comes before it.`);
  if (tokens > 0 && noiseShare >= 0.5) e('noise', 'warn', `About ${Math.round(noiseShare * 100)}% of this brief is material that does not change the fix. It competes with the parts that matter.`);
  else if (noiseTokens > 0 && noiseShare >= 0.2) e('some-noise', 'info', 'Some of this brief does not change the fix. Ask of each piece: would the answer change without it?');
  const overBudget = tokens > TASK.budget;
  if (overBudget) e('budget', 'bad', `This is about ${tokens} tokens against a budget of ${TASK.budget}. Something has to be dropped, and it is better that you choose what than that it is lost by accident.`);
  if (inc.has('policy') && inc.has('code') && !overBudget) e('policy', 'info', 'The helper is optional here: useful if the bug is in the policy, harmless if not, and it costs little.');

  const missingCore = !inc.has('code') || !inc.has('failure') || !inc.has('constraint') || !inc.has('acceptance');
  const sufficient = !missingCore && !inc.has('oldplan') && !overBudget && noiseShare < 0.2 && before < 300;
  if (sufficient) e('good', 'ok', 'Everything the task needs is here, the constraint is easy to see, there is no contradicting material, and it fits the budget. This is a brief that gives the work a fair chance.');
  if (tokens === 0) e('empty', 'info', 'The brief is empty. Add the pieces you think the task needs.');
  return { tokens, budget: TASK.budget, overBudget, noiseShare, tokensBeforeConstraint: before, effects, sufficient };
}

export interface ContextChallenge { id: string; title: string; goal: string; met: (s: ContextState) => boolean }
export const CONTEXT_CHALLENGES: ContextChallenge[] = [
  { id: 'c1', title: 'Make it sufficient', goal: 'Build a brief that has everything the task needs, no contradiction, and fits the budget.', met: (s) => assessContext(s).sufficient },
  { id: 'c2', title: 'The smallest one that works', goal: 'Do it again using the fewest tokens: at most 200.', met: (s) => { const r = assessContext(s); return r.sufficient && r.tokens <= 200; } },
  { id: 'c3', title: 'Rescue a bloated brief', goal: 'Start from "everything" and remove pieces until the brief is sufficient again, keeping the constraint at the top.', met: (s) => { const r = assessContext(s); return r.sufficient && s.constraintPlacement === 'first'; } },
];
