"use client";

import { use } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Circle, FileText, UploadCloud, Users, History, MoreVertical } from "lucide-react";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function PoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="max-w-6xl mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Apex Series A Secured Notes</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Active</Badge>
          </div>
          <p className="text-muted-foreground mt-1">Pool ID: {id}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <History className="mr-2 h-4 w-4" />
            Audit Log
          </Button>
          <Button className="bg-primary hover:bg-primary/90">
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Sidebar (Pool Meta) */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pool Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">Borrower</span>
                <span className="font-medium">Apex Holdings Ltd.</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Manager</span>
                <span className="font-medium">Capital Partners LLC</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Target Size</span>
                <span className="font-medium">$5,000,000 USD</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Created</span>
                <span className="font-medium">Oct 24, 2024</span>
              </div>
            </CardContent>
          </Card>

          <Card>
             <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">45% Complete</span>
                <span className="text-sm text-muted-foreground">9/20 items</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="col-span-1 md:col-span-3">
          <Tabs defaultValue="checklist" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="checklist" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> DD Checklist
              </TabsTrigger>
              <TabsTrigger value="files" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> VDR Files
              </TabsTrigger>
              <TabsTrigger value="members" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Access Control
              </TabsTrigger>
            </TabsList>

            <TabsContent value="checklist" className="space-y-4 shadow-sm border rounded-lg bg-card text-card-foreground">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Due Diligence Items</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Track and verify all required documentation for this pool.
                </p>
              </div>
              <div className="p-0">
                {/* Checklist Categories */}
                <div className="p-4 border-b bg-muted/30">
                  <h4 className="font-medium text-sm text-foreground">1. Legal & Corporate</h4>
                </div>
                {/* Items */}
                <div className="flex items-center justify-between p-4 border-b hover:bg-muted/10 transition-colors">
                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h5 className="font-medium">Certificate of Incorporation</h5>
                      <p className="text-sm text-muted-foreground mt-1">Uploaded and verified by Legal Counsel.</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">legal-cert.pdf</Badge>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View File</DropdownMenuItem>
                      <DropdownMenuItem>View History</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center justify-between p-4 border-b hover:bg-muted/10 transition-colors">
                  <div className="flex items-start gap-4">
                    <Circle className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <h5 className="font-medium">Board Resolutions authorizing the transaction</h5>
                      <p className="text-sm text-muted-foreground mt-1">Pending upload from the Borrower.</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Request File</Button>
                </div>

                <div className="p-4 border-b bg-muted/30">
                  <h4 className="font-medium text-sm text-foreground">2. Financials</h4>
                </div>
                <div className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="h-5 w-5 text-warning mt-0.5" />
                    <div>
                      <h5 className="font-medium">Audited Financial Statements (Last 2 Years)</h5>
                      <p className="text-sm text-warning mt-1">Under Review by Investment Committee.</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">audited-fs-2023.pdf</Badge>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Review File</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Reject</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files">
              <Card>
                <CardHeader>
                  <CardTitle>Virtual Data Room</CardTitle>
                  <CardDescription>
                    All encrypted documents uploaded to Walrus, protected by Sui network policies.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[400px] flex items-center justify-center border-t border-dashed bg-muted/10 rounded-b-xl">
                    <div className="text-center">
                        <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground">Files View</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-2">A standard file explorer view showcasing folders and decryptable files will be implemented here.</p>
                    </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members">
              <Card>
                 <CardHeader>
                  <CardTitle>Access Control</CardTitle>
                  <CardDescription>
                    Manage who has decryption rights to documents within this Data Room.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[400px] flex items-center justify-center border-t border-dashed bg-muted/10 rounded-b-xl">
                    <div className="text-center">
                        <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground">Members Management</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-2">Wallet addresses and roles will be displayed here, mapping to on-chain capabilities.</p>
                    </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
