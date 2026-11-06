import { SEEDS, renderDocument } from '@/domain/challenges/extraction';
import { CORPUS, ITEMS as CLAIMS } from '@/domain/challenges/research';
import { ITEMS as TRACES, TASK } from '@/domain/challenges/agent';
import { CHUNKS, QUESTIONS } from '@/domain/challenges/context';

export interface FixtureView { title: string; lines: string[] }
export const FIXTURE_VIEWS: Record<string, () => FixtureView[]> = {
  extraction: () => SEEDS.slice(0, 4).map((s) => ({ title: `${s.id}: ${s.title}`, lines: renderDocument(s).split('\n') })),
  research: () => [
    ...CORPUS.map((s) => ({ title: `${s.id} (${s.tier}, ${s.date}): ${s.title}`, lines: [s.text] })),
    { title: 'Draft claims (cited source in brackets)', lines: CLAIMS.map((c) => `${c.id} [${c.data.cites.join(', ')}] ${c.data.text}`) },
  ],
  agent: () => [{ title: 'Task given to the agent', lines: [TASK] }, ...TRACES.map((t) => ({ title: `${t.id}: ${t.data.title}`, lines: [...t.data.steps.map((x) => `${x.n}. ${x.tool}(${x.args}) -> ${x.ok ? 'ok' : 'ERROR'}: ${x.result}`), `Final message: ${t.data.final}`] }))],
  context: () => [{ title: 'Questions to answer', lines: QUESTIONS.map((q) => q.ask) }, { title: 'Available chunks', lines: CHUNKS.map((c) => `${c.id} (${c.date}${c.trusted ? '' : ', untrusted source'}): ${c.text}`) }],
};
