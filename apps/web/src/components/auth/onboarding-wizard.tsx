'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Link2, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/providers/auth-provider';


type Path = 'create' | 'join';
type Step = 1 | 2;

const fadeVariants = {
  initial: { opacity: 0, filter: 'blur(4px)' },
  animate: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.3 } },
  exit: { opacity: 0, filter: 'blur(4px)', transition: { duration: 0.15 } },
};

export function OnboardingWizard() {
  const [step, setStep] = useState<Step>(1);
  const [path, setPath] = useState<Path | null>(null);
  const [orgName, setOrgName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setOrg, apiClient } = useAuth();
  const router = useRouter();

  const handleSelectPath = (selected: Path) => {
    setPath(selected);
    setStep(2);
    setError(null);
  };

  const handleBack = () => {
    setStep(1);
    setPath(null);
    setError(null);
  };

  const handleCreateOrg = async () => {
    if (orgName.trim().length < 2) {
      setError('Organisation name must be at least 2 characters');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const org = await apiClient.post<{ id: string; name: string; legalName: string | null; billingPlan: string }>('/orgs', {
        name: orgName.trim(),
        legalName: legalName.trim() || undefined,
      });
      setOrg({ id: org.id, name: org.name, legalName: org.legalName, billingPlan: org.billingPlan as any });
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Failed to create organisation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinOrg = async () => {
    if (!inviteCode.trim()) {
      setError('Invite code is required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await apiClient.post<{ org: { id: string; name: string; legalName: string | null; billingPlan: string } }>('/orgs/join', {
        inviteCode: inviteCode.trim(),
      });
      setOrg({
        id: result.org.id,
        name: result.org.name,
        legalName: result.org.legalName,
        billingPlan: result.org.billingPlan as any,
      });
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err.code === 'INVITE_EXPIRED' ? 'Invite code has expired'
        : err.code === 'INVITE_USED' ? 'Invite code has already been used'
        : err.code === 'INVITE_NOT_FOUND' ? 'Invalid invite code'
        : (err.message ?? 'Failed to join organisation');
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[520px]">
      <p className="mb-6 text-center text-xs text-muted-foreground">
        Step {step} of 2
      </p>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" {...fadeVariants}>
            <h1 className="mb-2 text-center text-xl font-semibold text-foreground">
              Welcome to BrineVault
            </h1>
            <p className="mb-8 text-center text-sm text-muted-foreground">
              Create or join an organisation to get started
            </p>

            <div className="grid grid-cols-2 gap-4">
              <PathCard
                icon={<Building2 className="size-6 text-primary" />}
                title="Create Organisation"
                description="Set up a new org and invite your team"
                onClick={() => handleSelectPath('create')}
              />
              <PathCard
                icon={<Link2 className="size-6 text-primary" />}
                title="Join with Invite Code"
                description="Enter your code to join an existing org"
                onClick={() => handleSelectPath('join')}
              />
            </div>
          </motion.div>
        )}

        {step === 2 && path === 'create' && (
          <motion.div key="step2-create" {...fadeVariants}>
            <button
              onClick={handleBack}
              className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Back
            </button>

            <h2 className="mb-6 text-lg font-semibold text-foreground">
              Create Organisation
            </h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="org-name">Organisation Name *</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Apex Holdings Ltd."
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="legal-name">Legal Name</Label>
                <Input
                  id="legal-name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Optional"
                  className="mt-1.5"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                onClick={handleCreateOrg}
                disabled={isSubmitting || orgName.trim().length < 2}
                className="w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Create Organisation
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && path === 'join' && (
          <motion.div key="step2-join" {...fadeVariants}>
            <button
              onClick={handleBack}
              className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Back
            </button>

            <h2 className="mb-6 text-lg font-semibold text-foreground">
              Join with Invite Code
            </h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="invite-code">Invite Code *</Label>
                <Input
                  id="invite-code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                  className="mt-1.5 font-mono"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                onClick={handleJoinOrg}
                disabled={isSubmitting || !inviteCode.trim()}
                className="w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Join Organisation
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PathCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition-all duration-150 ease-out hover:border-primary hover:shadow-[0_1px_4px_rgba(0,123,255,0.12)]"
    >
      <CardContent className="flex flex-col items-center p-6 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/8">
          {icon}
        </div>
        <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
