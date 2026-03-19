import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function OnboardingPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create or join an organisation
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phase 2: Create Org / Join Org forms */}
        <p className="text-center text-sm text-muted-foreground">
          Onboarding implementation in S6 Session 2
        </p>
      </CardContent>
    </Card>
  );
}
