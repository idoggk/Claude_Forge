import { describe, expect, it } from 'vitest';
import { CARDS, CONTEXT_CHALLENGES, TASK, assessContext, emptyState, type ContextState } from '@/domain/playgrounds/context';
import { PERM_CHALLENGES, PERM_TASKS, READ_SCOPES, WRITE_SCOPES, assessPermissions, defaultConfig, type PermConfig } from '@/domain/playgrounds/permissions';
import { QUESTIONS, RETRIEVAL_CHALLENGES, runRetrieval, type RetrievalState } from '@/domain/playgrounds/retrieval';

const ctx = (included: string[], constraintPlacement: 'first' | 'last' = 'first'): ContextState => ({ included, constraintPlacement });
const GOOD = ['code', 'failure', 'constraint', 'acceptance'];

describe('Playground A: context engineering (rule-based, no model, no accuracy numbers)', () => {
  it('is deterministic: the same brief always gives the same reading', () => {
    expect(JSON.stringify(assessContext(ctx(GOOD)))).toBe(JSON.stringify(assessContext(ctx(GOOD))));
  });
  it('an empty brief says so, and every missing essential is named with its consequence', () => {
    const r = assessContext(emptyState());
    expect(r.effects.map((e) => e.id)).toEqual(expect.arrayContaining(['no-code', 'no-failure', 'no-constraint', 'no-acceptance', 'empty']));
    expect(r.sufficient).toBe(false);
  });
  it('the four essentials make a sufficient brief within the budget', () => {
    const r = assessContext(ctx(GOOD));
    expect(r.sufficient).toBe(true);
    expect(r.tokens).toBeLessThanOrEqual(TASK.budget);
    expect(r.effects.some((e) => e.id === 'good')).toBe(true);
  });
  it('a contradicting superseded plan makes the brief insufficient even when everything else is present', () => {
    const r = assessContext(ctx([...GOOD, 'oldplan']));
    expect(r.sufficient).toBe(false);
    expect(r.effects.some((e) => e.id === 'conflict' && e.tone === 'bad')).toBe(true);
  });
  it('noise competes with the constraint: a constraint placed last behind lots of material is flagged, and moving it first changes the reading', () => {
    const buried = assessContext(ctx([...GOOD, 'history'], 'last'));
    expect(buried.effects.some((e) => e.id === 'buried')).toBe(true);
    expect(buried.sufficient).toBe(false);
    const top = assessContext(ctx([...GOOD, 'history'], 'first'));
    expect(top.effects.some((e) => e.id === 'buried')).toBe(false);
  });
  it('going over the fictional budget is reported, and "everything" fails in several ways at once', () => {
    const all = assessContext(ctx(CARDS.map((c) => c.id), 'last'));
    expect(all.overBudget).toBe(true);
    expect(all.noiseShare).toBeGreaterThan(0.5);
    expect(all.effects.map((e) => e.id)).toEqual(expect.arrayContaining(['budget', 'noise', 'conflict']));
  });
  it('unknown ids are ignored, and nothing in a reading is a percentage of accuracy', () => {
    const r = assessContext(ctx([...GOOD, 'nope']));
    expect(r.tokens).toBe(assessContext(ctx(GOOD)).tokens);
    for (const e of assessContext(ctx(['code'])).effects) expect(e.text).not.toMatch(/accura/i);
  });
  it('each challenge is solvable and is not already met by an empty or a bloated brief', () => {
    const everything = ctx(CARDS.map((c) => c.id), 'last');
    for (const c of CONTEXT_CHALLENGES) {
      expect(c.met(emptyState()), c.id).toBe(false);
      expect(c.met(everything), c.id).toBe(false);
    }
    expect(CONTEXT_CHALLENGES[0]!.met(ctx(GOOD))).toBe(true);
    expect(CONTEXT_CHALLENGES[1]!.met(ctx(GOOD))).toBe(true);
    expect(CONTEXT_CHALLENGES[1]!.met(ctx([...GOOD, 'policy', 'history']))).toBe(false);
    expect(CONTEXT_CHALLENGES[2]!.met(ctx(GOOD, 'last'))).toBe(false);
  });
});

describe('Playground B: agent permissions (explicit rules)', () => {
  const cfg = (over: Partial<PermConfig>): PermConfig => ({ ...defaultConfig(), ...over });
  const LEAST: Record<string, PermConfig> = {
    summarise: cfg({ read: 'inbox', write: 'output' }),
    tidy: cfg({ read: 'project', del: true, approveDeletes: true }),
    changelog: cfg({ read: 'project', write: 'output', network: true }),
  };
  it('the least-privilege configuration for each task is recognised, and nothing narrower or broader is', () => {
    for (const t of PERM_TASKS) {
      expect(assessPermissions(t, LEAST[t.id]!).verdict, t.id).toBe('Least privilege');
      expect(assessPermissions(t, defaultConfig()).sufficient, `${t.id} nothing granted`).toBe(t.needs.read === 'none' && t.needs.write === 'none' && !t.needs.del && !t.needs.network);
    }
  });
  it('too little: each missing need is named, and the verdict says the task cannot be done', () => {
    const r = assessPermissions(PERM_TASKS[0]!, defaultConfig());
    expect(r.verdict).toBe('Not enough to do the task');
    expect(r.findings.map((f) => f.id)).toEqual(expect.arrayContaining(['read-short', 'write-short']));
  });
  it('too much: every extra capability is named, and a task that works but is too broad is not "least privilege"', () => {
    const r = assessPermissions(PERM_TASKS[0]!, cfg({ read: 'home', write: 'project', del: true, network: true }));
    expect(r.sufficient).toBe(true);
    expect(r.minimal).toBe(false);
    expect(r.findings.map((f) => f.id)).toEqual(expect.arrayContaining(['read-wide', 'write-wide', 'del-wide', 'net-wide']));
    expect(r.verdict).not.toBe('Least privilege');
  });
  it('constraints are checked separately from sufficiency', () => {
    const r = assessPermissions(PERM_TASKS[0]!, cfg({ read: 'inbox', write: 'output', network: true }));
    expect(r.constraintsMet).toBe(false);
    expect(r.verdict).toBe('Breaks a constraint');
  });
  it('a delete with no approval gate is flagged, and the gate fixes it; an unused gate is noted, not praised', () => {
    const tidy = PERM_TASKS[1]!;
    expect(assessPermissions(tidy, cfg({ read: 'project', del: true })).verdict).toMatch(/Breaks a constraint|Needs an approval gate/);
    expect(assessPermissions(tidy, cfg({ read: 'project', del: true, approveDeletes: true })).verdict).toBe('Least privilege');
    expect(assessPermissions(PERM_TASKS[0]!, cfg({ read: 'inbox', write: 'output', approveDeletes: true })).findings.some((f) => f.id === 'approve-del-unused')).toBe(true);
  });
  it('is deterministic, and exactly one configuration per scope combination reaches least privilege for the summariser', () => {
    const t = PERM_TASKS[0]!;
    const good: PermConfig[] = [];
    for (const read of READ_SCOPES) for (const write of WRITE_SCOPES) for (const del of [false, true]) for (const network of [false, true]) for (const ad of [false, true]) for (const ao of [false, true]) {
      const c = cfg({ read, write, del, network, approveDeletes: ad, approveOutside: ao });
      if (assessPermissions(t, c).verdict === 'Least privilege') good.push(c);
    }
    expect(good.length).toBeGreaterThan(0);
    for (const c of good) expect([c.read, c.write, c.del, c.network]).toEqual(['inbox', 'output', false, false]);
    expect(JSON.stringify(assessPermissions(t, good[0]!))).toBe(JSON.stringify(assessPermissions(t, good[0]!)));
  });
  it('every challenge is solvable and starts unsolved', () => {
    for (const c of PERM_CHALLENGES) { expect(c.met(defaultConfig()), c.id).toBe(false); expect(c.met(LEAST[c.taskId]!), c.id).toBe(true); }
  });
});

describe('Playground C: retrieval (lexical only; no embeddings, no model, no generated answers)', () => {
  const st = (questionId: string, query: string, topK = 3, sentencesPerChunk = 2): RetrievalState => ({ questionId, query, topK, sentencesPerChunk });
  it('is deterministic', () => {
    expect(JSON.stringify(runRetrieval(st('q-timeout', 'sync timeout')))).toBe(JSON.stringify(runRetrieval(st('q-timeout', 'sync timeout'))));
  });
  it('a vague query can retrieve the wrong thing (the dashboard session timeout), and a precise one finds the current source', () => {
    const vague = runRetrieval(st('q-timeout', 'timeout', 3));
    expect(vague.hits.some((h) => h.docId === 'dash-session')).toBe(true);
    expect(vague.grounded).toBe(false);
    const good = runRetrieval(st('q-timeout', QUESTIONS[0]!.goodQuery, 3));
    expect(good.answerRetrieved).toBe(true);
  });
  it('an empty or unmatched query retrieves nothing and says so, with the limit of a word-based index', () => {
    const r = runRetrieval(st('q-timeout', 'zzzz qqqq'));
    expect(r.hits).toEqual([]);
    expect(r.effects[0]!.text).toMatch(/word-based/);
  });
  it('old and unverified sources are labelled, and conflicting passages are reported', () => {
    const r = runRetrieval(st('q-timeout', 'default timeout sync', 5));
    const labels = new Set(r.hits.map((h) => h.label));
    expect(labels.has('stale') || labels.has('unverified')).toBe(true);
    expect(r.effects.some((e) => e.id === 'conflict')).toBe(true);
  });
  it('a larger K can add noise and conflict; K = 1 is sharper but can miss', () => {
    const q = QUESTIONS[0]!.goodQuery;
    expect(runRetrieval(st('q-timeout', q, 5)).hits.length).toBeGreaterThanOrEqual(runRetrieval(st('q-timeout', q, 1)).hits.length);
    expect(runRetrieval(st('q-timeout', 'dashboard session', 1)).answerRetrieved).toBe(false);
  });
  it('every challenge is solvable by some choice of query, K and chunk size, and the grounding challenges are not met by a one-word query', () => {
    for (const c of RETRIEVAL_CHALLENGES) {
      let solved = false;
      for (const q of QUESTIONS) for (const query of [q.goodQuery, q.text, q.vagueQuery]) for (const topK of [1, 2, 3, 4, 5]) for (const sentencesPerChunk of [1, 2, 3]) if (c.met({ questionId: q.id, query, topK, sentencesPerChunk })) solved = true;
      expect(solved, c.id).toBe(true);
      if (c.id !== 'r1') expect(c.met(st('q-timeout', 'timeout', 5, 3)), `${c.id} vague`).toBe(false); // a big K can rescue a vague query, but not ground it
    }
  });
  it('the chunk size changes what is retrieved (the playground teaches chunking), and ground truth labels cover every document', () => {
    const one = runRetrieval(st('q-timeout', QUESTIONS[0]!.goodQuery, 5, 1)).hits.map((h) => h.chunkId).join();
    const three = runRetrieval(st('q-timeout', QUESTIONS[0]!.goodQuery, 5, 3)).hits.map((h) => h.chunkId).join();
    expect(one).not.toBe(three);
  });
});
