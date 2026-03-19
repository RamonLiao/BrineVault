import { Lock, ShieldCheck, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChecklistItemData } from './step-checklist';
import type { MemberInviteData } from './step-members';

interface StepReviewProps {
  name: string;
  borrowerEntity: string;
  targetNotional: string;
  currency: string;
  maturityDate: string;
  encryptionScheme: 0 | 1;
  checklistItems: ChecklistItemData[];
  members: MemberInviteData[];
  onEditStep: (step: number) => void;
}

export function StepReview({
  name,
  borrowerEntity,
  targetNotional,
  currency,
  maturityDate,
  encryptionScheme,
  checklistItems,
  members,
  onEditStep,
}: StepReviewProps) {
  const requiredCount = checklistItems.filter(
    (i) => i.requirementLevel === 'required',
  ).length;
  const validMembers = members.filter((m) => m.address);

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">Basic Info</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEditStep(0)}
          >
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Pool Name</dt>
            <dd className="font-medium mt-0.5">{name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Borrower</dt>
            <dd className="font-medium mt-0.5">{borrowerEntity}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Target Size</dt>
            <dd className="font-medium mt-0.5">
              ${Number(targetNotional).toLocaleString()} {currency}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Maturity Date</dt>
            <dd className="font-medium mt-0.5">{maturityDate}</dd>
          </div>
        </dl>
      </div>

      {/* Encryption */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">Encryption Engine</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEditStep(1)}
          >
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {encryptionScheme === 0 ? (
            <>
              <Lock className="h-4 w-4" />
              <span className="font-medium">AES-256 Production</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 text-warning" />
              <span className="font-medium">Seal Beta</span>
            </>
          )}
        </div>
      </div>

      {/* Checklist */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">DD Checklist</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEditStep(2)}
          >
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </div>
        <p className="text-sm">
          {checklistItems.length} items ({requiredCount} required,{' '}
          {checklistItems.length - requiredCount} recommended/optional)
        </p>
      </div>

      {/* Members */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">Initial Members</h4>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEditStep(3)}
          >
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </div>
        <p className="text-sm">
          {validMembers.length > 0
            ? `${validMembers.length} member(s) will be invited`
            : 'No members added — you can invite later'}
        </p>
      </div>

      {/* Disclaimer */}
      <div className="p-4 bg-muted/50 rounded-md border text-sm text-muted-foreground">
        By clicking submit, you will be prompted to sign a{' '}
        <strong>Sui Transaction</strong> to create this pool on-chain.
      </div>
    </div>
  );
}
