import { useState } from 'react';
import { Button, Card, useToast } from '@/components/ui';
import { buildFixturePack, fixtureHash, getFixture, type FixtureId } from '@/fixtures';
import { downloadBlob } from '@/lib/download';

export function PackDownload({ fixtureId, label, description }: { fixtureId: string; label: string; description: string }) {
  const toast = useToast();
  const [hash, setHash] = useState<string | null>(null);
  const fx = getFixture(fixtureId);
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-muted">{description} Version {fx?.version ?? '1'}.</p>
        {hash && <p className="break-all text-xs text-muted" data-testid="pack-hash">Pack manifest SHA-256: {hash}</p>}
      </div>
      <Button icon="download" onClick={async () => { const p = await buildFixturePack(fixtureId as FixtureId); downloadBlob(p.blob, p.filename); setHash(await fixtureHash(fixtureId as FixtureId)); toast('Fixture pack downloaded'); }} data-testid={`download-${fixtureId}`}>Download fixture pack (ZIP)</Button>
    </Card>
  );
}
