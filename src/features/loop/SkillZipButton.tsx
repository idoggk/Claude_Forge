import { useState } from 'react';
import { Button, useToast } from '@/components/ui';
import type { SkillContent } from '@/domain/skills/model';
import { buildSkillZip } from '@/domain/skills/export';
import { downloadBlob } from '@/lib/download';

export function SkillZipButton({ content, label, suffix, testId }: { content: SkillContent | null | undefined; label: string; suffix: string; testId?: string }) {
  const toast = useToast();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <Button icon="download" disabled={!content} data-testid={testId} onClick={async () => {
        if (!content) return;
        setErr(null);
        try {
          const z = await buildSkillZip(content);
          downloadBlob(z.blob, z.filename.replace(/\.zip$/, `-${suffix}.zip`));
          toast(`${label} downloaded`);
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Export failed');
        }
      }}>{label}</Button>
      {err && <span role="alert" className="text-xs text-bad">{err}</span>}
    </span>
  );
}
