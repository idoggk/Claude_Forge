import { Callout, Markdown } from '@/components/ui';
import { CaseRunner } from '../CaseRunner';
import { PackDownload } from '../PackDownload';
import { SkillZipButton } from '../SkillZipButton';
import { revisionOf } from '@/persistence/loopRepo';
import { StepHeading, type StepProps } from './shared';

export function TestStep({ bundle }: StepProps) {
  const { mission, loop, skill } = bundle;
  const v1 = revisionOf(skill, loop.v1?.revisionId);
  return (
    <div className="space-y-4">
      <StepHeading n={4} title="Test Skill v1 on the same tasks">Same fixture, same prompts, same environment as the baseline. The only difference is that your frozen Skill is installed.</StepHeading>
      <div className="flex flex-wrap items-start gap-3">
        <SkillZipButton content={v1?.snapshot} label="Download Skill v1 (ZIP)" suffix="v1" testId="download-v1" />
      </div>
      <PackDownload fixtureId={mission.fixture.devId} label={mission.fixture.devLabel} description={mission.labels.packDescription} />
      <ol className="list-decimal space-y-1 pl-5 text-sm">{mission.skillHowTo.map((s) => <li key={s}><Markdown className="inline">{s}</Markdown></li>)}</ol>
      <Callout tone="warn" title="Do not nudge the Skill">Do not mention the Skill in your prompt. Whether its description makes it activate is part of what you are testing. Record &ldquo;No&rdquo; for activation if it did not load.</Callout>
      <CaseRunner bundle={bundle} phase="dev" condition="v1" conditionLabel="Skill v1" cases={mission.devCases} />
    </div>
  );
}
