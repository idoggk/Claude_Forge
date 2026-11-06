import type { Lesson } from '@/domain/curriculum/types';
import { o } from './helpers';
import { BUGGY_CONFIG, simulate, firstStageHoardAbove, sinkCoverage } from '@/fixtures/economy/sim';
import { REFERENCE_CONFIG } from '@/fixtures/economy/reference';

const buggy = simulate(BUGGY_CONFIG);
const fixed = simulate(REFERENCE_CONFIG);
const row = (rows: typeof buggy, stage: number) => rows.find((r) => r.stage === stage)!;

export const L07: Lesson = {
  id: 'L07-economy-inflation',
  version: 2,
  track: 'game-dev',
  order: 7,
  title: 'Economy Inflation Investigator',
  subtitle: 'Separate supply, sinks, bottlenecks and pacing in simulation data',
  prerequisites: ['L01-skill-or-tool'],
  competencies: ['economy-analysis'],
  effortMinutes: 18,
  gameRelevance: 3,
  interestTags: ['game-dev', 'experiments'],
  problem: 'Testers say "the late game gives too much currency". A big balance is a symptom with at least four different causes - and only one of them is inflation.',
  whyItMatters: 'Economy changes are where AI-assisted edits do the most quiet damage: a plausible constant tweak can reshape pacing. You need to read the data well enough to check Claude\'s diagnosis.',
  objectives: [
    'Define supply, sinks, bottlenecks and pacing and tell them apart in data.',
    'Use a ratio (affordability) instead of a raw balance as evidence.',
    'Pick the fix that targets the cause and name its collateral effects.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Four words that are not synonyms',
      body: `- **Supply:** how much currency enters the economy per unit of progress (rewards, drops, chests).
- **Sinks:** what removes currency - upgrades, fees, taxes, repairs.
- **Bottleneck / gate:** something that blocks spending or progress regardless of balance (a stage gate, a cooldown).
- **Pacing:** how quickly the player moves through content and power.

A pile of unspent currency can come from *too much supply*, *too few sinks*, or a *gate that prevents spending*. The fix differs for each.`,
    },
    {
      id: 's2',
      title: 'Measure ratios, not balances',
      body: `Raw balance grows in every healthy economy. Useful ratios:
- **Affordability** = income per stage ÷ price of the next upgrade. It answers "how many upgrades does one stage pay for?"
- **Hoard ratio** = balance ÷ price of the next upgrade. How many upgrades are sitting unspent?
- **Sink coverage** = (spend on sinks) ÷ income over a window.

*Healthy* means affordability is roughly **flat** - the price of progress keeps pace with income - not that the balance is small.`,
    },
    {
      id: 's3',
      title: 'A big balance is not automatically inflation',
      body: `In Fixture 2, **both** configurations accumulate surplus behind a stage gate; the healthy one holds a few upgrades' worth. What differs is the *trend in affordability*: flat in the reference, climbing more than threefold in the buggy build. Surplus behind a gate is a **bottleneck** question (should the gate move?). Runaway affordability is a **supply** problem (income and price have decoupled).

Don't trust "the balance is huge" - ask what the ratio did.`,
    },
    {
      id: 's4',
      title: 'Find the feedback loop',
      body: `The seeded imbalance is a feedback loop: reward power **compounds** (+10% per upgrade level) while upgrade cost grows +15% per level but income is *also* growing with stage. Each upgrade raises income, which buys the next upgrade faster… until the gate, not the economy, is the only thing slowing the player.

Fix options and their collateral: **linear power** (targets the cause), **a larger tax sink** (hits new players too and leaves the loop intact), **raise upgrade cost** (a crude brake that also slows the early game), **remove the gate** (would make things worse).`,
    },
  ],
  activity: {
    title: 'Read the simulation',
    intro: 'Switch between the as-shipped configuration and the reference fix in the lab, and compare the ratios. All data is synthetic and deterministic.',
    widget: 'economy-lab',
    items: [
      {
        id: 'l07-p1',
        kind: 'numeric',
        concept: 'economy-analysis',
        prompt: 'In the as-shipped (buggy) configuration, at which stage does the hoard ratio first exceed 5?',
        answer: () => firstStageHoardAbove(buggy, 5) ?? -1,
        unit: 'stage',
        hints: ['Sort the lab table by stage and look at the hoard-ratio column.'],
        explanation: 'Seeing when the pile first passes a threshold is how you date the onset of a problem.',
      },
      {
        id: 'l07-p2',
        kind: 'numeric',
        concept: 'economy-analysis',
        prompt: 'What is the affordability (income ÷ next upgrade price) at stage 60 in the as-shipped configuration? Round to one decimal.',
        answer: () => Math.round(row(buggy, 60).affordability * 10) / 10,
        tolerance: 0.1,
        hints: ['One stage of income buys this many "next upgrades".'],
        explanation: 'At stage 10 it was about 0.7: more than a threefold climb.',
      },
      {
        id: 'l07-p3',
        kind: 'classify',
        concept: 'economy-analysis',
        prompt: 'Classify each observation.',
        categories: [
          { id: 'supply', label: 'Supply' },
          { id: 'sink', label: 'Sinks' },
          { id: 'bottleneck', label: 'Bottleneck / gate' },
          { id: 'pacing', label: 'Pacing' },
          { id: 'normal', label: 'Normal / healthy' },
        ],
        entries: [
          { id: 'c1', text: 'Stage-60 income is ~3,250 shards in one config and ~720 in the other, with the same repair rate', correct: 'supply', why: 'Income diverged while sinks stayed identical.' },
          { id: 'c2', text: 'The repair tax is a flat 15% of income in both configs', correct: 'sink', why: 'A constant drain - not what changed between the configs.' },
          { id: 'c3', text: 'The player can afford the next upgrade but the stage gate has not opened yet', correct: 'bottleneck', why: 'Spending is blocked regardless of balance.' },
          { id: 'c4', text: 'Both configs sit at the same upgrade level at stage 30', correct: 'pacing', why: 'Progression speed is gate-controlled, so pacing did not diverge.' },
          { id: 'c5', text: 'Stage-to-stage income wobbles by up to ±10% because of seeded noise', correct: 'normal', why: 'Expected variation; not a trend.' },
        ],
        hints: ['Ask: does this change how much comes in, how much goes out, what blocks spending, or how fast the player moves?'],
        explanation: 'Only the first row shows what actually diverged.',
      },
      {
        id: 'l07-p4',
        kind: 'single',
        concept: 'economy-analysis',
        prompt: 'What is the root cause of the late-game imbalance?',
        options: [
          o('a', 'The repair sink is too weak, so currency is not being removed from the economy fast enough once players have upgraded a few times', 'Both configs have the same sink; it cannot explain the divergence.'),
          o('b', 'The early game hands out too much currency, so players arrive at the late game already rich and cannot be slowed down later', 'Early-game affordability is below 1 in both configs.'),
          o('c', 'Reward power compounds with upgrade level faster than prices grow, so each upgrade accelerates income - a feedback loop', 'Correct: the gate and the sink are the same; the coupling mode is the difference.'),
          o('d', 'The stage gate opens too slowly, so players accumulate currency while they wait to progress and the surplus builds up as a result', 'The gate is identical in both configs; it only makes the surplus visible.'),
        ],
        correct: 'c',
        explanation: 'The gate and the sink are the same; the coupling mode is the difference.',
      },
      {
        id: 'l07-p5',
        kind: 'single',
        concept: 'economy-analysis',
        prompt: 'Which fix targets the cause with the least collateral damage?',
        options: [
          o('a', 'Make power grow linearly with level (or lower the coupling)', 'Correct: removes the feedback loop and leaves early game untouched.'),
          o('b', 'Add a 30% tax on all income, so that every player earns less at every stage of the game', 'Regressive: it slows new players too and leaves the loop in place.', 'treat-the-symptom'),
          o('c', 'Remove the stage gate, so that players can spend the surplus as soon as they earn it', 'Would let the runaway income buy levels instantly - worse.'),
          o('d', 'Double all upgrade costs, so that each upgrade takes twice as long to afford at every stage', 'A crude brake that also slows the early game.'),
        ],
        correct: 'a',
        explanation: 'Match the fix to the cause, then check side effects.',
      },
    ],
  },
  assessment: {
    title: 'Economy analysis check',
    intro: 'Unseen questions on the same simulation. No hints.',
    passMark: 0.75,
    items: [
      {
        id: 'l07-a1',
        kind: 'numeric',
        concept: 'economy-analysis',
        prompt: 'In the REFERENCE configuration, what is the affordability at stage 40? (Two decimals; ±0.03 accepted.)',
        answer: () => row(fixed, 40).affordability,
        tolerance: 0.03,
        explanation: 'It stays near 0.5-0.6 for the whole run: flat is healthy.',
      },
      {
        id: 'l07-a2',
        kind: 'numeric',
        concept: 'economy-analysis',
        prompt: 'In the as-shipped configuration, what share of income do sinks (repair + upgrade spend) remove over stages 40-60? Enter a fraction such as 0.35 (±0.02 accepted).',
        answer: () => sinkCoverage(buggy, 40, 60),
        tolerance: 0.02,
        explanation: 'Low sink coverage with rising income is what lets the balance pile up.',
      },
      {
        id: 'l07-a3',
        kind: 'classify',
        concept: 'economy-analysis',
        prompt: 'Classify each observation.',
        categories: [
          { id: 'supply', label: 'Supply' },
          { id: 'sink', label: 'Sinks' },
          { id: 'bottleneck', label: 'Bottleneck / gate' },
          { id: 'pacing', label: 'Pacing' },
          { id: 'normal', label: 'Normal / healthy' },
        ],
        entries: [
          { id: 'k1', text: 'Affordability more than triples between stage 10 and stage 60', correct: 'supply', why: 'Income outgrows price.' },
          { id: 'k2', text: 'A flat percentage tax removes more shards in absolute terms as income grows, yet never changes income relative to price', correct: 'sink', why: 'A proportional drain scales with income; it cannot fix a ratio problem.' },
          { id: 'k3', text: 'The player holds enough shards for three upgrades but cannot buy until the next stage tier', correct: 'bottleneck', why: 'The gate blocks spending.' },
          { id: 'k4', text: 'Players reach the same level at the same stage in both versions', correct: 'pacing', why: 'Speed of progression is unchanged.' },
          { id: 'k5', text: 'Affordability stays between 0.5 and 0.6 from stage 10 to stage 60', correct: 'normal', why: 'Flat ratio = healthy.' },
        ],
        explanation: 'Always ask what the ratio did.',
      },
      {
        id: 'l07-a4',
        kind: 'single',
        concept: 'economy-analysis',
        prompt: 'A designer says "just add a 10% currency tax and call it fixed". What is the strongest objection?',
        options: [
          o('a', 'Taxes are unpopular with players, so the change would be reversed after the next feedback round', 'Popularity is a feeling, not an analysis of what the tax does to the economy.'),
          o('b', 'It reduces absolute surplus but leaves income compounding faster than prices, so affordability keeps climbing', 'Correct: a flat tax lowers the surplus but leaves income compounding faster than prices, so affordability keeps rising.'),
          o('c', 'A tax would break the simulation, because the balance model has no way to represent a levy', 'It would simulate fine; a tax is just another term in income.'),
          o('d', 'It would remove the gate, because a tax on income also taxes the currency used to open gates', 'A proportional tax does not touch the stage gate.'),
        ],
        correct: 'b',
        explanation: 'A proportional tax does not change the trend of the income-to-price ratio.',
      },
      {
        id: 'l07-a5',
        kind: 'multi',
        concept: 'economy-analysis',
        prompt: 'Which statements are correct? Select all.',
        options: [
          o('a', 'A large balance, by itself, does not prove inflation', 'Correct - gates can hold healthy surplus.'),
          o('b', 'Rising affordability (income ÷ price) is stronger evidence of runaway supply than the raw balance', 'Correct: compare like with like and prefer ratios.'),
          o('c', 'Adding sinks always fixes a supply problem', 'False - it may only treat the symptom.'),
          o('d', 'If two configs have the same sinks, sinks cannot explain the difference between them', 'Correct: compare like with like and prefer ratios.'),
        ],
        correct: ['a', 'b', 'd'],
        explanation: 'Compare like with like and prefer ratios.',
      },
      {
        id: 'l07-a6',
        kind: 'single',
        concept: 'economy-analysis',
        prompt: 'Claude reports: "balance at stage 60 is 29,000 shards - clear inflation." What do you ask for next?',
        options: [
          o('a', 'Nothing more: a number that large already proves inflation, so the fix can start immediately', 'A large balance is not inflation until you compare it with what things cost; the number alone has no baseline.'),
          o('b', 'The trend in income relative to the next upgrade\'s price, and whether a gate is holding the surplus', 'Correct: inflation is income outgrowing prices, so ask for the trend against the next upgrade\'s price and whether a gate holds the surplus.'),
          o('c', 'A screenshot of the shop at stage 60, to see whether the prices on display look reasonable', 'A screenshot shows one moment\'s prices, not how income and prices move over time.'),
          o('d', 'A longer written explanation of the cause, so that the reasoning behind the claim is clear', 'More explanation is not more evidence. Ask for the numbers that would support or contradict the claim.'),
        ],
        correct: 'b',
        explanation: 'You are checking the diagnosis, not just the conclusion.',
      },
    ],
  },
  failureModes: [
    'Calling any large balance "inflation".',
    'Reaching for a sink first, because it is easy to add.',
    'Comparing absolute numbers across configs with different sinks or gates.',
    'Skipping the simulation and tuning constants by feel.',
  ],
  application: {
    title: 'Add the ratios to your sim output',
    body: 'Add affordability, hoard ratio and sink coverage columns to your own economy simulation output. Practical takeaway: when Claude proposes a balance change, require it to report these three ratios before and after.',
    fieldPrompt: 'Log it under Growth → Field evidence when you use these ratios to review a real balance change.',
  },
  reviewItems: [
    {
      id: 'l07-r1',
      kind: 'single',
      concept: 'economy-analysis',
      prompt: 'Which metric answers "how many upgrades does one stage of income buy?"',
      options: [o('a', 'Affordability = income ÷ next upgrade price', 'Correct: income divided by the next upgrade\'s price keeps its meaning as the numbers scale up.'), o('b', 'Raw balance, which shows how much currency a player holds at the end of each stage', 'A raw balance grows in every healthy economy, so it cannot show runaway supply.'), o('c', 'Sink coverage, the share of income that the game\'s sinks remove from the economy each stage', 'Share of income removed.'), o('d', 'Level, which records how far the player has progressed through the upgrade ladder so far', 'Level records progress; it says nothing about what an upgrade costs relative to income.')],
      correct: 'a',
      explanation: 'Ratios survive scaling.',
    },
    {
      id: 'l07-r2',
      kind: 'single',
      concept: 'economy-analysis',
      prompt: 'Players hold a lot of currency but cannot buy the next upgrade until a stage tier opens. This is primarily a…',
      options: [o('a', 'Bottleneck', 'Correct: a gate blocks spending regardless of balance.'), o('b', 'Supply problem', 'A supply problem would show income outrunning prices; holding currency behind a gate does not show that.'), o('c', 'Sink problem', 'A sink problem would show currency not being removed; players who cannot yet buy anything are held by the gate.'), o('d', 'Pacing bug', 'It is the gate doing its job.')],
      correct: 'a',
      explanation: 'A gate blocks spending regardless of balance.',
    },
    {
      id: 'l07-r3',
      kind: 'multi',
      concept: 'economy-analysis',
      prompt: 'Select valid levers against runaway supply caused by compounding power.',
      options: [o('a', 'Make power scale linearly', 'Targets the loop.'), o('b', 'Lower the coupling constant', 'Targets the loop.'), o('c', 'Remove the stage gate', 'Removing the gate lets the surplus be spent at once, which speeds up the compounding and makes it worse.'), o('d', 'Add a larger tax sink only', 'A bigger tax sink alone treats the symptom and leaves the compounding power that causes the runaway supply.')],
      correct: ['a', 'b'],
      explanation: 'Cause first.',
    },
  ],
  sources: [],
};
