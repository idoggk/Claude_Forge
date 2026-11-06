export const MAX_SOURCES: number;
export const MAX_BODY_BYTES: number;
export const MIN_INTERVAL_MS: number;
export const TIMEOUT_MS: number;
export interface CheckRecord { checkedAt: string; httpStatus: number | null; redirectedTo: string | null; bodyHash: string | null; error: string | null }
export function validateSources(registry: unknown): { ok: boolean; problems: string[]; sources: { id: string; url: string; status?: string }[] };
export function sanitize(value: unknown, max?: number): string;
export function readCapped(response: Response, maxBytes?: number): Promise<Uint8Array>;
export function classify(source: { id: string; url: string; status?: string }, prev: CheckRecord | undefined, rec: CheckRecord): string[];
export function validateLastCheck(data: unknown, registry: unknown): { ok: boolean; problems: string[] };
