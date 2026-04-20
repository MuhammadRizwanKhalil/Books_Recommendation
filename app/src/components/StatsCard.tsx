import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  color?: string;
  testId?: string;
}

export function StatsCard({ icon: Icon, value, label, color, testId }: StatsCardProps) {
  return (
    <Card data-testid={testId}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('rounded-lg p-2', color || 'bg-primary/10 text-primary')}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
