import { Shield, Lock, CheckCircle } from 'lucide-react';
import { ZkLoginButton } from '@/components/auth/zklogin-button';
import { WalletConnectButton } from '@/components/auth/wallet-connect-button';
import { Separator } from '@/components/ui/separator';

export default function LoginPage() {
  return (
    <div className="flex w-full max-w-[820px] overflow-hidden rounded-xl border bg-card shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        {/* Left — Brand panel */}
        <div className="hidden w-[360px] shrink-0 flex-col justify-center border-r bg-gradient-to-br from-blue-50/80 via-blue-50/50 to-sky-50/80 p-10 md:flex dark:from-blue-950/30 dark:via-blue-950/20 dark:to-sky-950/30">
          <div className="mb-7 flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary shadow-[0_2px_8px_rgba(0,123,255,0.25)]">
              <Shield className="size-[18px] text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">
              BrineVault
            </span>
          </div>

          <h2 className="mb-2 text-base font-semibold leading-relaxed text-foreground">
            Institutional-Grade Data Vault
            <br />
            for Real-World Assets
          </h2>
          <p className="mb-8 text-[13px] leading-relaxed text-muted-foreground">
            Securing due diligence, legal docs, and asset proofs in a single
            encrypted workspace.
          </p>

          <div className="flex flex-col gap-2.5">
            <TrustBadge
              icon={<Lock className="size-3.5 text-primary" />}
              bg="bg-primary/8"
              label="Zero-Trust Client-Side Encryption"
            />
            <TrustBadge
              icon={<CheckCircle className="size-3.5 text-success" />}
              bg="bg-success/8"
              label="On-Chain Immutable Audit Trail"
            />
            <TrustBadge
              icon={<Shield className="size-3.5 text-purple-500" />}
              bg="bg-purple-500/8"
              label="Compliance-Grade Access Control"
            />
          </div>
        </div>

        {/* Right — Login form */}
        <div className="flex flex-1 flex-col justify-center px-9 py-10">
          {/* Mobile-only logo */}
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <Shield className="size-5 text-primary" />
            <span className="font-semibold tracking-tight">BrineVault</span>
          </div>

          <h1 className="text-xl font-semibold text-foreground">Welcome</h1>
          <p className="mb-8 text-[13px] text-muted-foreground">
            Sign in to access your data vault
          </p>

          <div className="space-y-2.5">
            <ZkLoginButton provider="google" />
            <ZkLoginButton provider="apple" />
          </div>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              or
            </span>
            <Separator className="flex-1" />
          </div>

          <WalletConnectButton />

          <p className="mt-8 text-center text-[11px] text-muted-foreground/60">
            Powered by{' '}
            <span className="font-medium text-muted-foreground">
              Sui Network
            </span>
          </p>
        </div>
      </div>
  );
}

function TrustBadge({
  icon,
  bg,
  label,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex size-7 shrink-0 items-center justify-center rounded-md ${bg}`}>
        {icon}
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </div>
  );
}
