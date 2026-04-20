import { useEffect, useState } from 'react';
import { BookOpen, ClipboardList, CheckCircle2, Ban } from 'lucide-react';
import { readingCountsApi, type ReadingCountsResponse } from '@/api/client';

interface ReadingCountsProps {
  bookId: string;
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

export function ReadingCounts({ bookId }: ReadingCountsProps) {
  const [counts, setCounts] = useState<ReadingCountsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readingCountsApi.getForBook(bookId)
      .then((data) => { if (!cancelled) setCounts(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [bookId]);

  // Hide on error or while loading
  if (error || !counts) return null;

  const items = [
    {
      key: 'currently-reading',
      icon: BookOpen,
      count: counts.currentlyReading,
      label: 'currently reading',
      testId: 'reading-count-current',
    },
    {
      key: 'want-to-read',
      icon: ClipboardList,
      count: counts.wantToRead,
      label: 'want to read',
      testId: 'reading-count-want',
    },
    {
      key: 'have-read',
      icon: CheckCircle2,
      count: counts.haveRead,
      label: 'have read',
      testId: 'reading-count-read',
    },
    {
      key: 'dnf',
      icon: Ban,
      count: counts.dnf ?? 0,
      label: 'did not finish',
      testId: 'reading-count-dnf',
    },
  ];

  return (
    <div
      data-testid="reading-counts-section"
      role="region"
      aria-label="Reading activity counts"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"
    >
      {items.map((item, i) => (
        <span key={item.key} className="flex items-center gap-1.5" data-testid={item.testId}>
          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span aria-label={`${formatCount(item.count)} people ${item.label}`}>
            <span className="font-medium text-foreground">{formatCount(item.count)}</span>
            {' '}{item.label}
          </span>
          {i < items.length - 1 && (
            <span className="ml-2 text-muted-foreground/50 hidden sm:inline" aria-hidden="true">·</span>
          )}
        </span>
      ))}
    </div>
  );
}
