import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StepBasicInfoProps {
  name: string;
  borrowerEntity: string;
  targetNotional: string;
  currency: string;
  maturityDate: string;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

export function StepBasicInfo({
  name,
  borrowerEntity,
  targetNotional,
  currency,
  maturityDate,
  errors,
  onChange,
}: StepBasicInfoProps) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor="pool-name">
          Pool Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="pool-name"
          value={name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g. Apex Series A Secured Notes"
          maxLength={256}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="borrower-name">
          Borrower Entity <span className="text-destructive">*</span>
        </Label>
        <Input
          id="borrower-name"
          value={borrowerEntity}
          onChange={(e) => onChange('borrowerEntity', e.target.value)}
          placeholder="e.g. Apex Holdings Ltd."
          maxLength={256}
        />
        {errors.borrowerEntity && (
          <p className="text-sm text-destructive">{errors.borrowerEntity}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="target-notional">
            Target Notional <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-muted-foreground">
              $
            </span>
            <Input
              id="target-notional"
              type="number"
              value={targetNotional}
              onChange={(e) => onChange('targetNotional', e.target.value)}
              placeholder="5,000,000"
              className="pl-7"
              min={1}
            />
          </div>
          {errors.targetNotional && (
            <p className="text-sm text-destructive">{errors.targetNotional}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            value={currency}
            onChange={(e) => onChange('currency', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="maturity-date">
          Maturity Date <span className="text-destructive">*</span>
        </Label>
        <Input
          id="maturity-date"
          type="date"
          value={maturityDate}
          onChange={(e) => onChange('maturityDate', e.target.value)}
          min={new Date().toISOString().split('T')[0]}
        />
        {errors.maturityDate && (
          <p className="text-sm text-destructive">{errors.maturityDate}</p>
        )}
      </div>
    </div>
  );
}
