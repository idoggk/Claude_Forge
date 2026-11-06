import type { Experiment } from './model';

/**
 * SYNTHETIC DEMONSTRATION. Every number below is invented to teach methodology.
 * It is not output from Claude, from any Skill, or from any real run.
 */
export const DEMO_ID = 'demo-merge-cascade';

const t = '2026-01-01T00:00:00.000Z';

export const DEMO_EXPERIMENT: Experiment = {
  id: DEMO_ID,
  experimentType: 'skill',
  subject: 'Does a merge-chain debugging Skill help Claude fix the seeded cascade bug? (synthetic demonstration)',
  schemaVersion: 1,
  title: 'DEMO (synthetic): does a debugging Skill help fix the merge-cascade bug?',
  problem: 'Does adding a systematic-debugging Skill change how reliably Claude fixes the seeded merge-cascade bug, compared with the same prompt without a Skill?',
  hypothesis: 'With the Skill, more runs will pass all fixture tests on the first attempt. We expect no difference in runtime.',
  fixture: { id: 'merge-cascade', label: 'Merge cascade bug (TypeScript)', version: '1', hash: 'synthetic-demo-no-hash' },
  successCriteria: ['All tests pass', 'No test file edited', 'Violated invariant named'],
  prompt: 'The tests fail. Find the root cause, fix it minimally, and run npm test.',
  environment: { claudeCodeVersion: '', model: '', settings: '', os: '', notes: 'Synthetic: no environment exists.' },
  plannedMeasures: ['testsPassedRatio', 'successRate', 'runtimeSec', 'developerEffortMin'],
  plannedRuns: 3,
  rubricLockedAt: t,
  conditions: [
    { id: 'demo-a', label: 'A', kind: 'no-skill', skillName: '', skillVersion: '', difference: 'Baseline: no Skill available' },
    { id: 'demo-b', label: 'B', kind: 'skill', skillName: 'systematic-debugging (illustrative)', skillVersion: 'unversioned', difference: 'One debugging Skill enabled; everything else identical' },
  ],
  runs: [
    { id: 'demo-a1', conditionId: 'demo-a', index: 1, recordedAt: t, testsPassed: 9, testsTotal: 10, testsProvenance: 'self-reported', successMet: false, seededFound: null, caseId: null, verdict: null, gradedTruth: null, skillActivated: null, metrics: { runtimeSec: { value: 140, provenance: 'self-reported' }, developerEffortMin: { value: 6, provenance: 'self-reported' } }, rubric: { correctness: 1, completeness: 2, maintainability: 2, testEvidence: 1 }, observations: 'Fixed the 4-group case, group-of-5 still fails.', attempt: 'completed', skillVersion: '', fixtureVersion: '', context: '' },
    { id: 'demo-a2', conditionId: 'demo-a', index: 2, recordedAt: t, testsPassed: 10, testsTotal: 10, testsProvenance: 'self-reported', successMet: true, seededFound: null, caseId: null, verdict: null, gradedTruth: null, skillActivated: null, metrics: { developerEffortMin: { value: 4, provenance: 'self-reported' } }, rubric: { correctness: 3, completeness: 3, maintainability: 2, testEvidence: 2 }, observations: 'Passed. Runtime was not timed (left unknown).', attempt: 'completed', skillVersion: '', fixtureVersion: '', context: '' },
    { id: 'demo-a3', conditionId: 'demo-a', index: 3, recordedAt: t, testsPassed: 8, testsTotal: 10, testsProvenance: 'self-reported', successMet: false, seededFound: null, caseId: null, verdict: null, gradedTruth: null, skillActivated: null, metrics: { runtimeSec: { value: 175, provenance: 'self-reported' }, developerEffortMin: { value: 9, provenance: 'self-reported' } }, rubric: { correctness: 1, completeness: 2, maintainability: 1, testEvidence: 1 }, observations: 'Special-cased groups of four.', attempt: 'completed', skillVersion: '', fixtureVersion: '', context: '' },
    { id: 'demo-b1', conditionId: 'demo-b', index: 1, recordedAt: t, testsPassed: 10, testsTotal: 10, testsProvenance: 'self-reported', successMet: true, seededFound: null, caseId: null, verdict: null, gradedTruth: null, skillActivated: null, metrics: { runtimeSec: { value: 190, provenance: 'self-reported' }, developerEffortMin: { value: 4, provenance: 'self-reported' } }, rubric: { correctness: 3, completeness: 3, maintainability: 3, testEvidence: 3 }, observations: 'Named the value-conservation invariant first.', attempt: 'completed', skillVersion: '', fixtureVersion: '', context: '' },
    { id: 'demo-b2', conditionId: 'demo-b', index: 2, recordedAt: t, testsPassed: 10, testsTotal: 10, testsProvenance: 'self-reported', successMet: true, seededFound: null, caseId: null, verdict: null, gradedTruth: null, skillActivated: null, metrics: { runtimeSec: { value: 205, provenance: 'self-reported' }, developerEffortMin: { value: 3, provenance: 'self-reported' } }, rubric: { correctness: 3, completeness: 3, maintainability: 2, testEvidence: 3 }, observations: 'Passed.', attempt: 'completed', skillVersion: '', fixtureVersion: '', context: '' },
    { id: 'demo-b3', conditionId: 'demo-b', index: 3, recordedAt: t, testsPassed: 9, testsTotal: 10, testsProvenance: 'self-reported', successMet: false, seededFound: null, caseId: null, verdict: null, gradedTruth: null, skillActivated: null, metrics: { runtimeSec: { value: 180, provenance: 'self-reported' } }, rubric: { correctness: 2, completeness: 3, maintainability: 2, testEvidence: 2 }, observations: 'One case missed; effort not recorded.', attempt: 'completed', skillVersion: '', fixtureVersion: '', context: '' },
  ],
  observations: 'In these synthetic runs, B passed the full test suite in 2 of 3 runs and A in 1 of 3. A passed 9/10, 10/10, 8/10 tests; B passed 10/10, 10/10, 9/10. Runtime was higher in B (180-205 s vs 140-175 s where timed). A\'s second runtime was not recorded and stays unknown.',
  conclusion: 'B looks directionally better on tests, but with 3 runs, one fixture and self-reported counts, this does NOT show the Skill is better. The next step is more runs and a second fixture.',
  limitations: 'Synthetic data. Three runs per condition. One fixture. Test counts are self-reported. Runtime favours A, so "better" depends on what you value.',
  status: 'concluded',
  synthetic: true,
  skillLinks: [],
  loopId: null,
  pilot: null,
  phase: null,
  runsLockedAt: null,
  createdAt: t,
  updatedAt: t,
};
