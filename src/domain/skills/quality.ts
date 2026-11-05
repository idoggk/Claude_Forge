import { contentOf, type SkillDraft } from './model';
import { designChecks, validateSkillContent } from './validate';
import { analyzeTuning } from './tuning';
import { LISTING_CAP } from './fields';

/**
 * Static Skill quality review. It reads the TEXT and the records you entered; it cannot run Claude, so it cannot say
 * whether the Skill works. Each dimension is a transparent rule with its reason, and the maturity ladder only
 * ticks a rung when the matching evidence exists in your data. "Field-proven" is never ticked here.
 */
export interface Dimension {
  id: string;
  title: string;
  /** 0 absent · 1 weak · 2 reasonable · 3 strong */
  score: 0 | 1 | 2 | 3;
  /** What the rule saw, in plain words. */
  evidence: string[];
  advice: string[];
}

export interface Rung {
  id: 'authored' | 'valid' | 'scenarios' | 'live' | 'measured' | 'field';
  label: string;
  reached: boolean;
  /** What exactly is required, and what Forge found. */
  requires: string;
  found: string;
}

export interface QualityReview {
  dimensions: Dimension[];
  ladder: Rung[];
  /** Number of dimensions scoring 2 or 3. Deliberately NOT a single "score". */
  solid: number;
  disclaimer: string;
}

export interface QualityContext {
  /** Improvement loops built on this Skill (from the loops store). */
  loops?: { skillId: string | null; status: 'active' | 'graduated' | 'abandoned' }[];
}

const lines = (s: string) => s.split('\n');
const has = (s: string, re: RegExp) => re.test(s);

export function reviewQuality(draft: SkillDraft, ctx: QualityContext = {}): QualityReview {
  const c = contentOf(draft);
  const body = c.instructions;
  const desc = `${c.description} ${c.whenToUse}`.trim();
  const dims: Dimension[] = [];
  const add = (d: Dimension) => dims.push(d);

  // 1. trigger clarity
  {
    const ev: string[] = [];
    const advice: string[] = [];
    let score = 0;
    const useWhen = has(desc, /\buse (?:when|for|this when)\b|\bwhen (?:the user|you|a user|someone)\b|\btrigger/i);
    const notFor = has(desc, /\bnot for\b|\bdo not use\b|\bdon'?t use\b|\bnot intended for\b/i);
    const len = desc.length;
    if (len >= 60) score++;
    if (useWhen) score++;
    if (notFor) score++;
    ev.push(`${len} characters (listing cap ${LISTING_CAP})`, useWhen ? 'Says WHEN to use it' : 'Never says when to use it', notFor ? 'Names a boundary ("Not for…")' : 'No "Not for…" boundary');
    const commaWords = (desc.match(/,/g) ?? []).length;
    if (commaWords > 12 && commaWords / Math.max(1, desc.split(/\s+/).length) > 0.3) { score = Math.max(0, score - 1) as 0 | 1 | 2 | 3; ev.push('Reads like a keyword list'); advice.push('Replace the word list with the symptoms and situations the Skill is for.'); }
    if (len < 60) advice.push('Say what the Skill does and the situations that should trigger it.');
    if (!useWhen) advice.push('Add a "Use when…" clause with the symptoms a user would describe.');
    if (!notFor) advice.push('Add a "Not for…" boundary so near-miss requests do not trigger it.');
    add({ id: 'trigger', title: 'Trigger clarity', score: score as 0 | 1 | 2 | 3, evidence: ev, advice });
  }

  // 2. procedure
  {
    const ev: string[] = [];
    const advice: string[] = [];
    const numbered = lines(body).filter((l) => /^\s*\d+[.)]\s+\S/.test(l)).length;
    const bullets = lines(body).filter((l) => /^\s*[-*]\s+\S/.test(l)).length;
    const steps = Math.max(numbered, bullets);
    const verifiable = lines(body).filter((l) => /^\s*(?:\d+[.)]|[-*])\s+/.test(l) && /\b(run|check|verify|quote|cite|list|compare|read|confirm|record|stop|ask)\b/i.test(l)).length;
    let score = 0;
    if (steps >= 3) score++;
    if (numbered >= 3) score++;
    if (steps >= 3 && verifiable / Math.max(1, steps) >= 0.5) score++;
    ev.push(`${numbered} numbered step(s), ${bullets} bullet(s)`, `${verifiable} step(s) with a checkable action (run / check / verify / quote / compare…)`);
    if (steps < 3) advice.push('Write the procedure as at least three numbered steps.');
    if (steps >= 3 && verifiable / Math.max(1, steps) < 0.5) advice.push('Make most steps checkable: say what to run, what to read, what to quote.');
    add({ id: 'procedure', title: 'Procedure', score: score as 0 | 1 | 2 | 3, evidence: ev, advice });
  }

  // 3. evidence gate
  {
    const gate = has(body, /\b(?:run|execute)\b[^.\n]{0,60}\b(?:before|first)\b|\bbefore (?:you )?(?:recommend|decide|answer|conclude|approve|say)\b|\bquote\b|\bcite\b|\bdo not (?:recommend|conclude|decide|approve)\b[^.\n]{0,60}\buntil\b/i);
    const cmd = has(body, /`[^`\n]*(?:npx|npm|node|python|git|tsx|pytest|vitest)[^`\n]*`/i);
    const score = (gate ? 2 : 0) + (cmd ? 1 : 0);
    add({
      id: 'evidence', title: 'Evidence gate', score: Math.min(3, score) as 0 | 1 | 2 | 3,
      evidence: [gate ? 'Requires evidence before a conclusion' : 'Nothing forces evidence before a conclusion', cmd ? 'Names an exact command' : 'No exact command to run'],
      advice: [...(gate ? [] : ['Add a gate: what must be run or read, and quoted, before any recommendation.']), ...(cmd ? [] : ['Name the exact command and the output that counts as evidence.'])],
    });
  }

  // 4. output contract
  {
    const section = has(body, /^#{1,4}\s*(?:output|format|report|answer|response|result)\b/im);
    const ending = has(body, /\b(?:finish|end|close|conclude)\b[^.\n]{0,40}\b(?:with|by)\b/i);
    const fields = lines(body).filter((l) => /^\s*(?:[-*]\s+)?\*?\*?[A-Z][A-Za-z ]{2,24}\*?\*?:\s/.test(l)).length;
    const score = (section ? 2 : 0) + (ending || fields >= 2 ? 1 : 0);
    add({
      id: 'output', title: 'Output contract', score: Math.min(3, score) as 0 | 1 | 2 | 3,
      evidence: [section ? 'Has an output / format section' : 'No output section', ending ? 'Defines how the answer ends' : 'No ending line defined', `${fields} labelled field(s)`],
      advice: score >= 2 ? [] : ['Define the exact sections of the answer, and the last line, so results are comparable run to run.'],
    });
  }

  // 5. stop conditions and safety
  {
    const stop = has(body, /\b(?:stop|do not|don'?t|never|unless|only if|ask (?:the user|me|for confirmation))\b/i);
    const safetyFindings = designChecks(c).filter((f) => f.area === 'safety' || /absolute|contradict|permission/i.test(f.message));
    const scan = validateSkillContent(c).findings.filter((f) => f.area === 'safety' && f.severity !== 'info');
    const score = (stop ? 2 : 0) + (scan.length === 0 ? 1 : 0);
    add({
      id: 'safety', title: 'Stop conditions & safety', score: Math.min(3, score) as 0 | 1 | 2 | 3,
      evidence: [stop ? 'States when to stop or what not to do' : 'No stop condition or prohibition', scan.length === 0 ? 'Safety scan found nothing' : `${scan.length} safety finding(s) from the scanner`, ...(safetyFindings.length ? [`${safetyFindings.length} design note(s) about permissions or absolutes`] : [])],
      advice: [...(stop ? [] : ['Say when the Skill must stop or ask rather than carry on.']), ...(scan.length ? ['Resolve the scanner findings (Validate tab).'] : [])],
    });
  }

  // 6. progressive disclosure
  {
    const n = lines(body).length;
    const refs = c.references.length;
    const linked = c.references.filter((r) => body.includes(r.path)).length;
    let score = 0;
    if (n <= 500) score++;
    if (n <= 200 || refs > 0) score++;
    if (refs === 0 || linked === refs) score++;
    add({
      id: 'disclosure', title: 'Progressive disclosure', score: score as 0 | 1 | 2 | 3,
      evidence: [`SKILL.md body is ${n} line(s)`, `${refs} supporting file(s), ${linked} linked from the body`],
      advice: [...(n > 500 ? ['Move detail into supporting files and link them.'] : []), ...(refs > linked ? ['Link every supporting file from the body so Claude knows when to read it.'] : [])],
    });
  }

  // 7. scenario coverage
  const pos = draft.scenarios.filter((s) => s.expected === 'activate').length;
  const neg = draft.scenarios.filter((s) => s.expected === 'not-activate').length;
  const amb = draft.scenarios.filter((s) => s.expected === 'ambiguous').length;
  {
    let score = 0;
    if (pos >= 2) score++;
    if (neg >= 2) score++;
    if (amb >= 1 && pos >= 2 && neg >= 2) score++;
    add({
      id: 'scenarios', title: 'Trigger scenario coverage', score: score as 0 | 1 | 2 | 3,
      evidence: [`${pos} should-activate · ${neg} should-not · ${amb} ambiguous`],
      advice: [...(pos < 2 ? ['Add at least two prompts that should activate, one of them a paraphrase.'] : []), ...(neg < 2 ? ['Add at least two prompts that should not, including a near-miss.'] : []), ...(amb < 1 ? ['Add an ambiguous prompt and decide what the Skill should do with it.'] : [])],
    });
  }

  // 8. live evidence (current observations only)
  const tuning = analyzeTuning(draft);
  const currentObs = tuning.counted.positives + tuning.counted.negatives;
  {
    const score = currentObs === 0 ? 0 : currentObs < 4 ? 1 : currentObs < 8 ? 2 : 3;
    add({
      id: 'live', title: 'Live-test evidence', score: score as 0 | 1 | 2 | 3,
      evidence: [`${currentObs} current observation(s) you recorded from real Claude Code sessions`, tuning.headline],
      advice: currentObs < 4 ? ['Run your scenarios in a real session and record what happened (Live test tab).'] : [],
    });
  }

  const validation = validateSkillContent(c);
  const graduated = (ctx.loops ?? []).filter((l) => l.skillId === draft.id && l.status === 'graduated').length;
  const started = (ctx.loops ?? []).filter((l) => l.skillId === draft.id).length;
  const ladder: Rung[] = [
    { id: 'authored', label: 'Authored', reached: Boolean(c.name.trim() && c.description.trim() && body.trim()), requires: 'A name, a description and instructions', found: `${c.name ? 'name' : 'no name'}, ${c.description ? 'description' : 'no description'}, ${body.trim() ? 'instructions' : 'no instructions'}` },
    { id: 'valid', label: 'Valid', reached: validation.errors === 0 && Boolean(c.name.trim()), requires: 'No validation errors', found: `${validation.errors} error(s), ${validation.warnings} warning(s)` },
    { id: 'scenarios', label: 'Scenario-covered', reached: pos >= 2 && neg >= 2, requires: 'At least 2 should-activate and 2 should-not scenarios', found: `${pos} should-activate, ${neg} should-not` },
    { id: 'live', label: 'Live-tested', reached: tuning.counted.positives >= 1 && tuning.counted.negatives >= 1 && currentObs >= 4, requires: 'At least 4 current live observations, covering a should-activate and a should-not scenario', found: `${currentObs} current (${tuning.counted.positives} should-activate, ${tuning.counted.negatives} should-not)` },
    { id: 'measured', label: 'Measured against no Skill', reached: graduated > 0, requires: 'A completed Skill Improvement Loop (baseline, v1, revision, held-out)', found: `${graduated} graduated loop(s), ${started} started` },
    { id: 'field', label: 'Field-proven', reached: false, requires: 'Your own recorded evidence from real project use. Forge cannot infer this from a fixture or a review.', found: 'Not claimable from this review' },
  ];

  return {
    dimensions: dims,
    ladder,
    solid: dims.filter((d) => d.score >= 2).length,
    disclaimer: 'Static review: it reads the text and your records. A strong review shows the Skill is well-formed, not that it works. Only live tests and measured comparisons show behaviour, and "field-proven" needs your own real-project evidence.',
  };
}
