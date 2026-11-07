import { Alert, Badge } from '@mrd/ui';

export function DraftNotice({ kind = 'legal' }: { kind?: 'legal' | 'clinical' }) {
  return (
    <Alert tone="warning" className="my-6">
      <p>
        <Badge tone="draft" className="mr-2">
          Draft
        </Badge>
        {kind === 'clinical'
          ? 'This clinical content is a draft. It has not yet been approved by the responsible pharmacist and must not be relied on.'
          : 'This policy is a draft. It has not yet been legally reviewed or approved and does not form part of any agreement.'}
      </p>
    </Alert>
  );
}
