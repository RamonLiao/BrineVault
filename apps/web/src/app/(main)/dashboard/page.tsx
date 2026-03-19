import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FolderKanban, ShieldCheck, PieChart, ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const MOCK_POOLS = [
  {
    id: "pool_0x1a2b",
    name: "Apex Series A Secured Notes",
    borrower: "Apex Holdings Ltd.",
    target: "$5,000,000",
    status: "Active",
    members: 12,
    completion: "45%"
  },
  {
    id: "pool_0x3c4d",
    name: "Green Energy Transition Fund",
    borrower: "Solaris Corp",
    target: "$12,500,000",
    status: "Review",
    members: 8,
    completion: "90%"
  }
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Overview of your RWA DataRoom pools and pending actions.</p>
        </div>
        <Link href="/pools/new">
          <Button className="bg-primary hover:bg-primary/90">
             Create New Pool
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pools</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_POOLS.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Actively managed data rooms</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Asset Value</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$17.5M</div>
            <p className="text-xs text-muted-foreground mt-1">Across all active pools</p>
          </CardContent>
        </Card>
        <Card className="border-warning/50 bg-warning/5 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-warning">Pending IC Reviews</CardTitle>
            <ShieldCheck className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">1</div>
            <p className="text-xs text-warning/80 mt-1">Require immediate attention</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Active Pools</h2>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {MOCK_POOLS.map((pool) => (
             <Link href={`/pools/${pool.id}`} key={pool.id} className="group">
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">{pool.name}</CardTitle>
                      <CardDescription className="mt-1">{pool.borrower}</CardDescription>
                    </div>
                    <Badge variant={pool.status === 'Active' ? 'default' : 'secondary'} className={pool.status === 'Active' ? 'bg-primary/20 text-primary border-primary/30' : ''}>
                      {pool.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm mb-4">
                     <div className="flex items-center text-muted-foreground">
                        <Users className="h-4 w-4 mr-2" />
                        {pool.members} Members
                     </div>
                     <div className="font-semibold">{pool.target}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">DD Progress</span>
                      <span className="font-medium">{pool.completion}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: pool.completion }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
             </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
