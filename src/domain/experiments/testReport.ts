import { z } from 'zod';

export const MAX_EVIDENCE_BYTES = 512 * 1024;

export interface TestCounts {
  passed: number;
  failed: number;
  total: number;
  format: string;
}

const Count = z.number().int().min(0).max(1_000_000);

const VitestJest = z.object({ numPassedTests: Count, numFailedTests: Count, numTotalTests: Count.optional() }).passthrough();
const Generic = z.object({ passed: Count, failed: Count, total: Count.optional() }).passthrough();

/**
 * Parse an uploaded test report as DATA. Accepts vitest/jest JSON reporter output or a simple
 * {passed, failed, total}. The text is never evaluated; only numeric counts are read.
 */
export function parseTestReport(text: string): { ok: true; counts: TestCounts } | { ok: false; error: string } {
  if (new TextEncoder().encode(text).length > MAX_EVIDENCE_BYTES) return { ok: false, error: `File is larger than ${MAX_EVIDENCE_BYTES / 1024} KB.` };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  const vj = VitestJest.safeParse(data);
  if (vj.success) {
    const { numPassedTests: passed, numFailedTests: failed } = vj.data;
    const total = vj.data.numTotalTests ?? passed + failed;
    if (passed + failed > total) return { ok: false, error: 'Counts are inconsistent (passed + failed exceeds total).' };
    return { ok: true, counts: { passed, failed, total, format: 'vitest/jest JSON' } };
  }
  const g = Generic.safeParse(data);
  if (g.success) {
    const total = g.data.total ?? g.data.passed + g.data.failed;
    if (g.data.passed + g.data.failed > total) return { ok: false, error: 'Counts are inconsistent (passed + failed exceeds total).' };
    return { ok: true, counts: { passed: g.data.passed, failed: g.data.failed, total, format: 'generic {passed, failed, total}' } };
  }
  return { ok: false, error: 'Unrecognized report. Expected vitest/jest JSON (numPassedTests/numFailedTests) or {passed, failed, total}.' };
}

/** Evidence uploads are text only. Binary-looking content is rejected. */
export function looksBinary(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u0008\u000E-\u001F]/.test(text.slice(0, 4000));
}
