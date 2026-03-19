import type { LucideIcon } from 'lucide-react';

interface TabPlaceholderProps {
  icon: LucideIcon;
  title: string;
  session: string;
}

export function TabPlaceholder({
  icon: Icon,
  title,
  session,
}: TabPlaceholderProps) {
  return (
    <div className="border rounded-lg flex flex-col items-center justify-center py-20 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/30 mb-3" />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Coming in {session}
      </p>
    </div>
  );
}
