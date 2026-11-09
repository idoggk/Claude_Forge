/**
 * Playground B: agent permissions. Explicit, deterministic rules compare what an agent is granted with what its task needs
 * and with the task's constraints. It does not run an agent or inspect real settings. It teaches least privilege: grant what
 * the task needs, over the narrowest scope, and put a person in front of what cannot be undone.
 */
export const READ_SCOPES = ['none', 'inbox', 'project', 'home'] as const;
export const WRITE_SCOPES = ['none', 'output', 'project'] as const;
export type ReadScope = (typeof READ_SCOPES)[number];
export type WriteScope = (typeof WRITE_SCOPES)[number];
export const READ_LABELS: Record<ReadScope, string> = { none: 'Nothing', inbox: 'The inbox folder only', project: 'The whole project', home: 'The whole home folder' };
export const WRITE_LABELS: Record<WriteScope, string> = { none: 'Nothing', output: 'The output folder only', project: 'The whole project' };

export interface PermConfig { read: ReadScope; write: WriteScope; del: boolean; network: boolean; approveDeletes: boolean; approveOutside: boolean }
export interface PermTask {
  id: string; title: string; description: string;
  /** Minimum the task needs. */
  needs: { read: ReadScope; write: WriteScope; del: boolean; network: boolean };
  constraints: { text: string; check: (c: PermConfig) => boolean }[];
  /** Whether a delete must have a human approval gate if it is granted. */
  deleteNeedsApproval: boolean;
}

const rank = (list: readonly string[], v: string) => list.indexOf(v);

export const PERM_TASKS: PermTask[] = [
  { id: 'summarise', title: 'Summarise private notes', description: 'Read the Markdown files in the inbox folder and save one summary per file in the output folder.',
    needs: { read: 'inbox', write: 'output', del: false, network: false },
    constraints: [{ text: 'The notes are private and must not leave this machine.', check: (c) => !c.network }, { text: 'Source files must never be changed.', check: (c) => rank(WRITE_SCOPES, c.write) <= rank(WRITE_SCOPES, 'output') }],
    deleteNeedsApproval: true },
  { id: 'tidy', title: 'Tidy old exports', description: 'Delete export files older than 90 days from the exports folder inside the project, after listing them.',
    needs: { read: 'project', write: 'none', del: true, network: false },
    constraints: [{ text: 'A delete cannot be undone, so a person must approve it before it happens.', check: (c) => !c.del || c.approveDeletes }, { text: 'Nothing may be sent off the machine.', check: (c) => !c.network }],
    deleteNeedsApproval: true },
  { id: 'changelog', title: 'Draft release notes', description: 'Read the project, write release notes to the output folder, and look up the public issue titles on the project\'s website.',
    needs: { read: 'project', write: 'output', del: false, network: true },
    constraints: [{ text: 'Do not touch anything outside the output folder without a person agreeing.', check: (c) => rank(WRITE_SCOPES, c.write) <= rank(WRITE_SCOPES, 'output') || c.approveOutside }, { text: 'Only public information may leave the machine.', check: (c) => rank(READ_SCOPES, c.read) < rank(READ_SCOPES, 'home') }],
    deleteNeedsApproval: true },
];

export interface PermFinding { id: string; kind: 'insufficient' | 'too-broad' | 'constraint' | 'approval' | 'ok'; tone: 'ok' | 'warn' | 'bad' | 'info'; text: string }
export interface PermReading { findings: PermFinding[]; sufficient: boolean; minimal: boolean; constraintsMet: boolean; approvalsOk: boolean; verdict: string }

export const defaultConfig = (): PermConfig => ({ read: 'none', write: 'none', del: false, network: false, approveDeletes: false, approveOutside: false });

export function assessPermissions(task: PermTask, c: PermConfig): PermReading {
  const f: PermFinding[] = [];
  const add = (id: string, kind: PermFinding['kind'], tone: PermFinding['tone'], text: string) => f.push({ id, kind, tone, text });
  const n = task.needs;
  if (rank(READ_SCOPES, c.read) < rank(READ_SCOPES, n.read)) add('read-short', 'insufficient', 'bad', `The task cannot be done: it needs to read ${READ_LABELS[n.read].toLowerCase()}, and this grants ${READ_LABELS[c.read].toLowerCase()}.`);
  if (rank(WRITE_SCOPES, c.write) < rank(WRITE_SCOPES, n.write)) add('write-short', 'insufficient', 'bad', `The task cannot be done: it needs to write to ${WRITE_LABELS[n.write].toLowerCase()}, and this grants ${WRITE_LABELS[c.write].toLowerCase()}.`);
  if (n.del && !c.del) add('del-short', 'insufficient', 'bad', 'The task cannot be done: it has to delete files and delete is not granted.');
  if (n.network && !c.network) add('net-short', 'insufficient', 'bad', 'The task cannot be done: it needs to look something up on the network and network access is off.');
  if (rank(READ_SCOPES, c.read) > rank(READ_SCOPES, n.read)) add('read-wide', 'too-broad', 'warn', `Reading is wider than the task needs: ${READ_LABELS[c.read].toLowerCase()} when ${READ_LABELS[n.read].toLowerCase()} is enough. Anything in reach can be read by a hostile instruction too.`);
  if (rank(WRITE_SCOPES, c.write) > rank(WRITE_SCOPES, n.write)) add('write-wide', 'too-broad', 'warn', `Writing is wider than the task needs: ${WRITE_LABELS[c.write].toLowerCase()} when ${WRITE_LABELS[n.write].toLowerCase()} is enough.`);
  if (c.del && !n.del) add('del-wide', 'too-broad', 'warn', 'Delete is granted but the task never deletes anything. That is risk with no benefit.');
  if (c.network && !n.network) add('net-wide', 'too-broad', 'warn', 'Network access is on but the task does not need it. It is the usual way for data to leave.');
  for (const k of task.constraints) if (!k.check(c)) add(`constraint-${f.length}`, 'constraint', 'bad', `This breaks a constraint: ${k.text}`);
  if (c.del && task.deleteNeedsApproval && !c.approveDeletes) add('approve-del', 'approval', 'warn', 'Deleting is granted with no approval gate. A person should see the list before anything is removed, because it cannot be undone.');
  if (!c.del && c.approveDeletes) add('approve-del-unused', 'approval', 'info', 'There is an approval gate for deletes, but delete is not granted, so it will never be used.');
  const sufficient = !f.some((x) => x.kind === 'insufficient');
  const tooBroad = f.some((x) => x.kind === 'too-broad');
  const constraintsMet = !f.some((x) => x.kind === 'constraint');
  const approvalsOk = !f.some((x) => x.id === 'approve-del');
  const minimal = sufficient && !tooBroad;
  if (minimal && constraintsMet && approvalsOk) add('good', 'ok', 'ok', 'This is least privilege for this task: it can do the job, nothing more, the constraints hold and a person sees what cannot be undone.');
  const verdict = !sufficient ? 'Not enough to do the task' : !constraintsMet ? 'Breaks a constraint' : tooBroad ? 'Works, but broader than needed' : !approvalsOk ? 'Needs an approval gate' : 'Least privilege';
  return { findings: f, sufficient, minimal, constraintsMet, approvalsOk, verdict };
}

export interface PermChallenge { id: string; taskId: string; title: string; goal: string; met: (c: PermConfig) => boolean }
export const PERM_CHALLENGES: PermChallenge[] = PERM_TASKS.map((t) => ({ id: `p-${t.id}`, taskId: t.id, title: t.title, goal: 'Reach "Least privilege".', met: (c: PermConfig) => assessPermissions(t, c).verdict === 'Least privilege' }));
