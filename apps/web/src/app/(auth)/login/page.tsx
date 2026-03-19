import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="size-6 text-primary" />
        </div>
        <CardTitle className="text-xl">RWA DataRoom</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in to access your data rooms
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phase 2: zkLogin buttons + wallet connect */}
        <p className="text-center text-sm text-muted-foreground">
          Login implementation in S6 Session 2
        </p>
      </CardContent>
    </Card>
  );
}
