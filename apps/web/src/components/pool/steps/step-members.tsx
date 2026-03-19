import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROLE } from '@/types';

export interface MemberInviteData {
  id: string;
  address: string;
  role: number;
}

interface StepMembersProps {
  members: MemberInviteData[];
  currentUserAddress: string;
  errors: Record<string, string>;
  onMembersChange: (members: MemberInviteData[]) => void;
  onSkip: () => void;
}

const ROLE_OPTIONS = [
  { label: 'Editor', value: ROLE.EDITOR },
  { label: 'Reviewer', value: ROLE.REVIEWER },
  { label: 'Viewer', value: ROLE.VIEWER },
];

const SUI_ADDRESS_RE = /^0x[a-fA-F0-9]{64}$/;

export function StepMembers({
  members,
  currentUserAddress,
  errors,
  onMembersChange,
  onSkip,
}: StepMembersProps) {
  function updateMember(
    id: string,
    field: 'address' | 'role',
    value: string | number,
  ) {
    onMembersChange(
      members.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
  }

  function removeMember(id: string) {
    onMembersChange(members.filter((m) => m.id !== id));
  }

  function addMember() {
    onMembersChange([
      ...members,
      { id: crypto.randomUUID(), address: '', role: ROLE.VIEWER },
    ]);
  }

  function getAddressError(member: MemberInviteData): string | null {
    if (!member.address) return null;
    if (!SUI_ADDRESS_RE.test(member.address)) return 'Invalid Sui address format';
    if (member.address.toLowerCase() === currentUserAddress.toLowerCase())
      return 'Cannot invite yourself';
    const dupes = members.filter(
      (m) =>
        m.id !== member.id &&
        m.address &&
        m.address.toLowerCase() === member.address.toLowerCase(),
    );
    if (dupes.length > 0) return 'Duplicate address';
    return null;
  }

  return (
    <div className="space-y-4">
      {members.map((member) => {
        const addrError = getAddressError(member);
        return (
          <div key={member.id} className="space-y-1">
            <div className="grid grid-cols-[2fr_1fr_32px] gap-3 items-center">
              <Input
                value={member.address}
                onChange={(e) =>
                  updateMember(member.id, 'address', e.target.value)
                }
                placeholder="0x..."
                className={addrError ? 'border-destructive' : ''}
              />
              <select
                value={member.role}
                onChange={(e) =>
                  updateMember(member.id, 'role', Number(e.target.value))
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeMember(member.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {addrError && (
              <p className="text-xs text-destructive pl-1">{addrError}</p>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addMember}>
          + Add Member
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
