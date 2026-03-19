'use client';

import { Bell, Menu, Shield } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onMenuToggle}
      >
        <Menu className="size-5" />
      </Button>

      <Link href="/dashboard" className="flex items-center gap-2">
        <Shield className="size-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">RWA DataRoom</span>
      </Link>

      <div className="flex-1" />

      <Button variant="ghost" size="icon-sm" className="relative">
        <Bell className="size-4" />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive" />
      </Button>

      {/* Phase 2: ConnectButton / user avatar */}
      <Button variant="outline" size="sm">
        Connect Wallet
      </Button>
    </header>
  );
}
