import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BookSeriesEntry } from '@/types';

interface SeriesBadgeProps {
  series: BookSeriesEntry[];
}

export function SeriesBadge({ series }: SeriesBadgeProps) {
  if (!series || series.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {series.map((s) => (
        <Link key={s.id} to={`/series/${s.slug}`}>
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1 text-sm cursor-pointer hover:bg-primary/10 hover:border-primary/50 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>
              Book {Number.isInteger(s.position) ? s.position : s.position.toFixed(1)} of{' '}
              {s.totalBooks} in <span className="font-semibold">{s.name}</span>
            </span>
          </Badge>
        </Link>
      ))}
    </div>
  );
}
