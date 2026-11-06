import type { Engine, Row } from './lab';
import { pct } from './lab';
import { EXTRACTORS, MAX_VALIDATORS, VALIDATORS, questions, runValidatorLab } from './extraction';

/** Adapter that presents Challenge A (structured extraction) through the shared engine interface. */
export const extractionEngine: Engine = {
  groups: [{ id: 'validators', title: 'Validators to run on every extractor', hint: `Choose up to ${MAX_VALIDATORS}. Each validator reads one extracted record and its source document.`, options: VALIDATORS.map((v) => ({ id: v.id, label: v.label, what: v.what })) }],
  max: MAX_VALIDATORS,
  run(selected) {
    const r = runValidatorLab(selected);
    const rows: Row[] = [
      ...r.perExtractor.map((p) => ({ tone: (p.missed.length === 0 ? 'ok' : 'bad') as Row['tone'], label: EXTRACTORS.find((e) => e.id === p.extractorId)!.label, detail: `caught ${p.caught.length} of ${p.seeded.length} seeded errors${p.missed.length ? `; missed: ${p.missed.map((m) => `${m.docId}.${m.field}`).join(', ')}` : ''}` })),
      ...r.perExtractor.flatMap((p) => p.falseAlarms.map((g) => ({ tone: 'warn' as const, label: `False alarm on ${g.docId}.${g.field}`, detail: `${g.validatorId}: ${g.message}` }))),
      ...r.notes.map((n) => ({ tone: 'info' as const, label: 'Note', detail: n })),
    ];
    return { passed: r.passed, headline: r.passed ? 'At least 90% of every extractor\'s errors were caught with no false alarms.' : 'Not yet: an error is getting through, or a correct value is being rejected.', coverage: r.coverage, falseAlarms: r.falseAlarms, stats: [{ label: 'Errors caught', value: `${r.caughtTotal} of ${r.seededTotal}` }, { label: 'False alarms', value: String(r.falseAlarms) }, { label: 'Lowest coverage', value: pct(r.coverage) }], rows };
  },
  questions: () => questions().map((q) => ({ id: q.id, prompt: q.prompt, options: q.options, correct: q.correct, explain: q.explain })),
};
