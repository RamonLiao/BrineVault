'use client';

import { useReducer } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/providers/auth-provider';
import { useCreatePool } from '@/lib/api/hooks/use-create-pool';
import { StepIndicator } from '@/components/pool/step-indicator';
import { StepBasicInfo } from '@/components/pool/steps/step-basic-info';
import { StepEncryption } from '@/components/pool/steps/step-encryption';
import {
  StepChecklist,
  type ChecklistItemData,
} from '@/components/pool/steps/step-checklist';
import {
  StepMembers,
  type MemberInviteData,
} from '@/components/pool/steps/step-members';
import { StepReview } from '@/components/pool/steps/step-review';
import { DEFAULT_DD_CHECKLIST_ITEMS } from '@/lib/default-checklist';

const STEPS = [
  'Basic Info',
  'Encryption Engine',
  'DD Checklist',
  'Initial Members',
  'Review & Confirm',
];

interface PoolFormState {
  name: string;
  borrowerEntity: string;
  targetNotional: string;
  currency: string;
  maturityDate: string;
  encryptionScheme: 0 | 1;
  sealBetaAcknowledged: boolean;
  checklistItems: ChecklistItemData[];
  members: MemberInviteData[];
  currentStep: number;
  errors: Record<string, string>;
  isSubmitting: boolean;
  returnToReview: boolean;
}

type FormAction =
  | { type: 'SET_FIELD'; field: string; value: unknown }
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_ERRORS'; errors: Record<string, string> }
  | { type: 'SET_CHECKLIST'; items: ChecklistItemData[] }
  | { type: 'SET_MEMBERS'; members: MemberInviteData[] }
  | { type: 'SET_SUBMITTING'; value: boolean }
  | { type: 'EDIT_FROM_REVIEW'; step: number }
  | { type: 'RETURN_TO_REVIEW' };

function formReducer(state: PoolFormState, action: FormAction): PoolFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value, errors: {} };
    case 'SET_STEP':
      return { ...state, currentStep: action.step, errors: {}, returnToReview: false };
    case 'SET_ERRORS':
      return { ...state, errors: action.errors };
    case 'SET_CHECKLIST':
      return { ...state, checklistItems: action.items };
    case 'SET_MEMBERS':
      return { ...state, members: action.members };
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.value };
    case 'EDIT_FROM_REVIEW':
      return { ...state, currentStep: action.step, returnToReview: true };
    case 'RETURN_TO_REVIEW':
      return { ...state, currentStep: 4, returnToReview: false };
    default:
      return state;
  }
}

function buildDefaultItems(): ChecklistItemData[] {
  return DEFAULT_DD_CHECKLIST_ITEMS.map((item, idx) => ({
    id: crypto.randomUUID(),
    folderId: item.folderId,
    label: item.label,
    description: item.description ?? '',
    requirementLevel: item.requirementLevel as 'required' | 'recommended' | 'optional',
    expectedDocType: item.expectedDocType,
    sortOrder: idx,
  }));
}

function validateStep1(state: PoolFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!state.name.trim()) errors.name = 'Pool name is required';
  if (state.name.length > 256) errors.name = 'Pool name must be 256 characters or less';
  if (!state.borrowerEntity.trim()) errors.borrowerEntity = 'Borrower entity is required';
  if (!state.targetNotional || Number(state.targetNotional) <= 0)
    errors.targetNotional = 'Target notional must be greater than 0';
  if (!state.maturityDate) errors.maturityDate = 'Maturity date is required';
  else if (new Date(state.maturityDate) <= new Date())
    errors.maturityDate = 'Maturity date must be in the future';
  return errors;
}

function validateStep2(state: PoolFormState): Record<string, string> {
  if (state.encryptionScheme === 1 && !state.sealBetaAcknowledged) {
    return { sealBetaAcknowledged: 'Please acknowledge the Beta disclaimer' };
  }
  return {};
}

export default function NewPoolPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { mutateAsync: createPool, isPending } = useCreatePool();

  const [state, dispatch] = useReducer(formReducer, null, () => ({
    name: '',
    borrowerEntity: '',
    targetNotional: '',
    currency: 'USD',
    maturityDate: '',
    encryptionScheme: 0 as 0 | 1,
    sealBetaAcknowledged: false,
    checklistItems: buildDefaultItems(),
    members: [] as MemberInviteData[],
    currentStep: 0,
    errors: {} as Record<string, string>,
    isSubmitting: false,
    returnToReview: false,
  }));

  function handleFieldChange(field: string, value: unknown) {
    dispatch({ type: 'SET_FIELD', field, value });
  }

  function handleNext() {
    if (state.currentStep === 0) {
      const errors = validateStep1(state);
      if (Object.keys(errors).length > 0) {
        dispatch({ type: 'SET_ERRORS', errors });
        return;
      }
    }
    if (state.currentStep === 1) {
      const errors = validateStep2(state);
      if (Object.keys(errors).length > 0) {
        dispatch({ type: 'SET_ERRORS', errors });
        return;
      }
    }

    if (state.returnToReview) {
      dispatch({ type: 'RETURN_TO_REVIEW' });
    } else {
      dispatch({ type: 'SET_STEP', step: state.currentStep + 1 });
    }
  }

  function handleBack() {
    if (state.returnToReview) {
      dispatch({ type: 'RETURN_TO_REVIEW' });
    } else {
      dispatch({ type: 'SET_STEP', step: state.currentStep - 1 });
    }
  }

  async function handleSubmit() {
    dispatch({ type: 'SET_SUBMITTING', value: true });
    try {
      const poolId = await createPool({
        name: state.name,
        borrowerEntity: state.borrowerEntity,
        targetNotional: state.targetNotional,
        currency: state.currency,
        maturityDate: state.maturityDate,
        encryptionScheme: state.encryptionScheme,
        tags: [],
        members: state.members.filter((m) => m.address),
      });
      toast.success('Pool created successfully!');
      router.push(`/pools/${poolId}`);
    } catch (err: any) {
      if (err?.message?.includes('cancelled') || err?.message?.includes('rejected')) {
        toast.error('Transaction cancelled');
      } else {
        toast.error(err?.message ?? 'Failed to create pool');
      }
      dispatch({ type: 'SET_SUBMITTING', value: false });
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create New Pool</h1>
        <p className="text-muted-foreground mt-2">
          Follow the steps below to set up a new data room for your credit pool.
        </p>
      </div>

      <StepIndicator steps={STEPS} currentStep={state.currentStep} />

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>{STEPS[state.currentStep]}</CardTitle>
          <CardDescription>
            {state.currentStep === 0 &&
              'Provide basic details about the new credit pool.'}
            {state.currentStep === 1 &&
              'Select the cryptographic protocol to secure your files.'}
            {state.currentStep === 2 &&
              'Customize the Due Diligence checklist template.'}
            {state.currentStep === 3 &&
              'Invite initial members and reviewers.'}
            {state.currentStep === 4 &&
              'Review your pool configuration before submission.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px]">
          {state.currentStep === 0 && (
            <StepBasicInfo
              name={state.name}
              borrowerEntity={state.borrowerEntity}
              targetNotional={state.targetNotional}
              currency={state.currency}
              maturityDate={state.maturityDate}
              errors={state.errors}
              onChange={handleFieldChange}
            />
          )}
          {state.currentStep === 1 && (
            <StepEncryption
              encryptionScheme={state.encryptionScheme}
              sealBetaAcknowledged={state.sealBetaAcknowledged}
              onChange={handleFieldChange}
            />
          )}
          {state.currentStep === 2 && (
            <StepChecklist
              items={state.checklistItems}
              onItemsChange={(items) =>
                dispatch({ type: 'SET_CHECKLIST', items })
              }
            />
          )}
          {state.currentStep === 3 && (
            <StepMembers
              members={state.members}
              currentUserAddress={user?.address ?? ''}
              errors={state.errors}
              onMembersChange={(members) =>
                dispatch({ type: 'SET_MEMBERS', members })
              }
              onSkip={handleNext}
            />
          )}
          {state.currentStep === 4 && (
            <StepReview
              name={state.name}
              borrowerEntity={state.borrowerEntity}
              targetNotional={state.targetNotional}
              currency={state.currency}
              maturityDate={state.maturityDate}
              encryptionScheme={state.encryptionScheme}
              checklistItems={state.checklistItems}
              members={state.members}
              onEditStep={(step) =>
                dispatch({ type: 'EDIT_FROM_REVIEW', step })
              }
            />
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6 bg-muted/10">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={state.currentStep === 0 || state.isSubmitting}
          >
            Back
          </Button>
          {state.currentStep < STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Next Step
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={state.isSubmitting || isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {state.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Confirm & Submit'
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
