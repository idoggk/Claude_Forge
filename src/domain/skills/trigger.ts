/**
 * Offline trigger heuristic for the Trigger Dojo and Workshop design checks.
 *
 * IMPORTANT: this is a transparent lexical-overlap exercise, NOT a model of how
 * Claude actually decides to load a Skill. Claude reads descriptions semantically
 * and may activate when wording differs - or stay quiet when wording matches.
 * Only a manual live test in Claude Code shows real behaviour.
 */
const STOPWORDS = new Set(
  'a an the and or but if then else for to of in on at by with from as is are was were be been being it its this that these those i you we they he she my your our their me us do does did not no can could should would will use used using user users when whenever any all some more most other into over under about than so such also just like need needs want wants please how what why which who where there here out up down off again very'.split(' '),
);

export function stem(w: string): string {
  let s = w;
  if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith('ed')) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith('es')) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  return s;
}

export function tokens(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2 && !STOPWORDS.has(t))
        .map(stem),
    ),
  );
}

const NEG_SPLIT = /\b(?:do\s+not\s+use|don'?t\s+use|not\s+for|not\s+intended\s+for)\b/i;

export function splitDescription(description: string): { positive: string; negative: string } {
  const m = NEG_SPLIT.exec(description);
  if (!m) return { positive: description, negative: '' };
  return { positive: description.slice(0, m.index), negative: description.slice(m.index + m[0].length) };
}

export type HeuristicVerdict = 'likely' | 'ambiguous' | 'unlikely';

export interface TriggerPrediction {
  /** 0..1 lexical overlap strength. Not a probability. */
  score: number;
  verdict: HeuristicVerdict;
  matched: string[];
  excluded: string[];
  explanation: string;
}

export const LIKELY_AT = 0.4;
export const AMBIGUOUS_AT = 0.18;

export function predictActivation(description: string, whenToUse: string, prompt: string): TriggerPrediction {
  const { positive, negative } = splitDescription(`${description} ${whenToUse}`.trim());
  const pos = new Set(tokens(positive));
  const neg = new Set(tokens(negative));
  const p = tokens(prompt);
  if (pos.size === 0 || p.length === 0) {
    return { score: 0, verdict: 'unlikely', matched: [], excluded: [], explanation: pos.size === 0 ? 'The description has no content words to match against.' : 'The prompt has no content words.' };
  }
  const matched = p.filter((t) => pos.has(t) && !neg.has(t));
  const excluded = p.filter((t) => neg.has(t) && !pos.has(t));
  const coverage = matched.length / p.length;
  const recall = matched.length / pos.size;
  const score = Math.min(1, 0.7 * coverage + 0.3 * Math.min(1, recall * 3));
  let verdict: HeuristicVerdict = score >= LIKELY_AT ? 'likely' : score >= AMBIGUOUS_AT ? 'ambiguous' : 'unlikely';
  let explanation: string;
  if (excluded.length >= 1 && excluded.length >= matched.length) {
    verdict = 'unlikely';
    explanation = `The prompt overlaps with the exclusion clause (${excluded.join(', ')}) at least as much as with the positive description.`;
  } else if (matched.length === 0) {
    explanation = 'No shared content words. Claude might still match semantically, but nothing in the wording points to this Skill.';
  } else {
    explanation = `Shared terms: ${matched.join(', ')} (${Math.round(coverage * 100)}% of the prompt's content words appear in the description).`;
  }
  return { score: Math.round(score * 100) / 100, verdict, matched, excluded, explanation };
}

/** Short, stable fingerprint of the trigger text, so a live test can be tied to the wording it actually tested. */
export function triggerFingerprint(description: string, whenToUse: string): string {
  const text = `${description}\u0000${whenToUse}`.replace(/\s+/g, ' ').trim();
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
