import { Lock, ShieldCheck } from 'lucide-react';

interface StepEncryptionProps {
  encryptionScheme: 0 | 1;
  sealBetaAcknowledged: boolean;
  onChange: (field: string, value: unknown) => void;
}

export function StepEncryption({
  encryptionScheme,
  sealBetaAcknowledged,
  onChange,
}: StepEncryptionProps) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onChange('encryptionScheme', 0)}
          className={`border-2 rounded-xl p-6 text-left cursor-pointer hover:border-primary transition-colors ${
            encryptionScheme === 0
              ? 'border-primary bg-primary/5'
              : 'border-border'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-background rounded-lg shadow-sm border">
              <Lock className="h-6 w-6 text-foreground" />
            </div>
            <div
              className={`h-4 w-4 rounded-full border-4 ${
                encryptionScheme === 0
                  ? 'border-primary bg-background'
                  : 'border-muted-foreground/30 bg-background'
              }`}
            />
          </div>
          <h3 className="font-semibold text-lg">AES-256 Production</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Industry standard symmetric encryption. Keys are distributed
            on-chain via public keys.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChange('encryptionScheme', 1)}
          className={`border-2 rounded-xl p-6 text-left cursor-pointer hover:border-primary transition-colors relative overflow-hidden ${
            encryptionScheme === 1
              ? 'border-primary bg-primary/5'
              : 'border-border'
          }`}
        >
          <div className="absolute top-0 right-0 bg-warning text-warning-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
            Beta - 10% Off
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-background rounded-lg shadow-sm border">
              <ShieldCheck className="h-6 w-6 text-warning" />
            </div>
            <div
              className={`h-4 w-4 rounded-full border-4 ${
                encryptionScheme === 1
                  ? 'border-primary bg-background'
                  : 'border-muted-foreground/30 bg-background'
              }`}
            />
          </div>
          <h3 className="font-semibold text-lg">Seal Beta</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Threshold encryption via Sui Seal. Innovative on-chain policy
            enforcement.
          </p>
        </button>
      </div>

      {encryptionScheme === 1 && (
        <label className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg border border-warning/20 cursor-pointer">
          <input
            type="checkbox"
            checked={sealBetaAcknowledged}
            onChange={(e) =>
              onChange('sealBetaAcknowledged', e.target.checked)
            }
            className="h-4 w-4 rounded border-warning accent-warning"
          />
          <span className="text-sm">
            I understand this is a Beta feature and may have limitations.
          </span>
        </label>
      )}
    </div>
  );
}
