"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, ShieldCheck, Lock } from "lucide-react";
import Link from "next/link";

const STEPS = [
  "Basic Info",
  "Encryption Engine",
  "DD Checklist",
  "Initial Members",
  "Review & Confirm"
];

export default function NewPoolPage() {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create New Pool</h1>
        <p className="text-muted-foreground mt-2">Follow the steps below to setup a new restricted data room for your credit pool.</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 w-full h-0.5 bg-muted -z-10 -translate-y-1/2" />
        {STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          return (
            <div key={step} className="flex flex-col items-center gap-2 bg-background px-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${isActive ? 'border-primary bg-primary text-primary-foreground' : isCompleted ? 'border-primary bg-primary/10 text-primary' : 'border-muted-foreground/30 bg-background text-muted-foreground'}`}>
                {index + 1}
              </div>
              <span className={`text-xs font-medium ${isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>

      {/* Form Content */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>{STEPS[currentStep]}</CardTitle>
          <CardDescription>
            {currentStep === 0 && "Provide basic details about the new credit pool."}
            {currentStep === 1 && "Select the underlying cryptographic protocol to secure your files."}
            {currentStep === 2 && "Customize the Due Diligence checklist template."}
            {currentStep === 3 && "Invite the initial members and reviewers."}
            {currentStep === 4 && "Review your pool configuration before submission."}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px]">
          {/* Step 1: Basic Info */}
          {currentStep === 0 && (
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="pool-name">Pool Name <span className="text-destructive">*</span></Label>
                <Input id="pool-name" placeholder="e.g. Apex Series A Secured Notes" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="borrower-name">Borrower Entity <span className="text-destructive">*</span></Label>
                <Input id="borrower-name" placeholder="e.g. Apex Holdings Ltd." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="target-notional">Target Notional</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                    <Input id="target-notional" type="number" placeholder="5,000,000" className="pl-7" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" defaultValue="USD" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Encryption Engine */}
          {currentStep === 1 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border-2 rounded-xl p-6 cursor-pointer hover:border-primary border-primary bg-primary/5 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-background rounded-lg shadow-sm border">
                    <Lock className="h-6 w-6 text-foreground" />
                  </div>
                  <div className="h-4 w-4 rounded-full border-4 border-primary bg-background" />
                </div>
                <h3 className="font-semibold text-lg">AES-256 Production</h3>
                <p className="text-sm text-muted-foreground mt-2">Industry standard symmetric encryption. Keys are distributed on-chain via public keys.</p>
              </div>

              <div className="border-2 rounded-xl p-6 cursor-pointer hover:border-primary border-border transition-colors group relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-warning text-warning-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                  Beta - 10% Off
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-background rounded-lg shadow-sm border">
                    <ShieldCheck className="h-6 w-6 text-warning" />
                  </div>
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground bg-background group-hover:border-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-lg">Seal Beta</h3>
                <p className="text-sm text-muted-foreground mt-2">Threshold encryption via Sui Seal. Innovative on-chain policy enforcement.</p>
              </div>
            </div>
          )}

          {/* Placeholders for subsequent steps */}
          {currentStep > 1 && currentStep < 4 && (
            <div className="flex h-[200px] items-center justify-center border-2 border-dashed rounded-lg bg-muted/20">
              <p className="text-muted-foreground font-medium">Interactive components for {STEPS[currentStep]} to be implemented.</p>
            </div>
          )}

          {currentStep === 4 && (
            <div className="rounded-lg border bg-card p-6 shadow-sm">
                <h3 className="font-semibold text-lg mb-4">Summary</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Pool Name</dt>
                    <dd className="font-medium mt-1">Apex Series A Secured Notes</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Borrower</dt>
                    <dd className="font-medium mt-1">Apex Holdings Ltd.</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Target Size</dt>
                    <dd className="font-medium mt-1">$5,000,000 (USD)</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Encryption Engine</dt>
                    <dd className="font-medium mt-1 inline-flex items-center gap-1.5"><Lock className="h-3 w-3"/> AES-256 Production</dd>
                  </div>
                </dl>
                <div className="mt-8 p-4 bg-muted/50 rounded-md border text-sm text-muted-foreground">
                  By clicking submit, you will be prompted to sign a <strong>Sui Transaction</strong> to officially create this Data Room object on-chain.
                </div>
            </div>
          )}

        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6 bg-muted/10">
          <Button variant="outline" onClick={prevStep} disabled={currentStep === 0}>
            Back
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={nextStep} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Next Step
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
              Confirm & Submit
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
