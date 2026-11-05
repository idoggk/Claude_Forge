import { DIAGNOSTIC } from '@/content/diagnostic';
import { gradeItem } from '../assessment/grade';
import { pickedMisconceptions } from '../assessment/misconception';
import { COMPETENCY_BY_ID } from '../curriculum/competencies';
import type { CompetencyId, Lesson } from '../curriculum/types';
import type { DiagnosticRecord } from '@/persistence/schemas';

export interface DiagnosticOutcome {
  results: DiagnosticRecord['results'];
  gaps: string[];
  solid: string[];
  misconceptions: string[];
}

/** Deterministic grading. An unanswered question counts as a gap, never as correct. */
export function gradeDiagnostic(answers: Record<string, unknown>): DiagnosticOutcome {
  const results: DiagnosticRecord['results'] = [];
  const misconceptions: string[] = [];
  for (const item of DIAGNOSTIC.items) {
    const g = gradeItem(item, answers[item.id]);
    results.push({ itemId: item.id, concept: item.concept, correct: g.correct, answered: g.answered });
    if (!g.correct) for (const m of pickedMisconceptions(item, answers[item.id])) if (!misconceptions.includes(m)) misconceptions.push(m);
  }
  return { results, gaps: results.filter((r) => !r.correct).map((r) => r.concept), solid: results.filter((r) => r.correct).map((r) => r.concept), misconceptions };
}

export interface DiagnosticHint {
  takenAt: string;
  gaps: CompetencyId[];
  solid: CompetencyId[];
  misconceptions: string[];
}

export function latestHint(records: DiagnosticRecord[]): DiagnosticHint | null {
  const last = [...records].filter((r) => r.diagnosticId === DIAGNOSTIC.id && r.diagnosticVersion === DIAGNOSTIC.version).sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
  if (!last) return null;
  const known = (xs: string[]) => xs.filter((x): x is CompetencyId => x in COMPETENCY_BY_ID);
  return { takenAt: last.takenAt, gaps: known(last.gaps), solid: known(last.solid), misconceptions: last.misconceptions };
}

/** The lessons that build a competency, in curriculum order. */
export function lessonsFor(c: string, lessons: Lesson[]): Lesson[] {
  return lessons.filter((l) => l.competencies.includes(c as CompetencyId)).sort((a, b) => a.order - b.order);
}
