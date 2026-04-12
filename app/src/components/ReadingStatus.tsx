import { useState, useEffect, useCallback } from 'react';
import { BookOpen, CheckCircle2, BookMarked, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { readingProgressApi } from '@/api/client';

type ReadingStatus = 'none' | 'want-to-read' | 'reading' | 'finished';

const STATUS_CONFIG: Record<ReadingStatus, { label: string; icon: typeof BookOpen; color: string } | null> = {
  'none': null,
  'want-to-read': { label: 'Want to Read', icon: BookMarked, color: 'text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' },
  'reading': { label: 'Currently Reading', icon: BookOpen, color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800' },
  'finished': { label: 'Finished', icon: CheckCircle2, color: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' },
};

const STORAGE_KEY = 'thebooktimes-reading-status';

function getStatuses(): Record<string, ReadingStatus> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStatusLocal(bookId: string, status: ReadingStatus) {
  const all = getStatuses();
  if (status === 'none') {
    delete all[bookId];
  } else {
    all[bookId] = status;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

interface ReadingStatusButtonProps {
  bookId: string;
  size?: 'sm' | 'default';
  className?: string;
}

export function ReadingStatusButton({ bookId, size = 'default', className }: ReadingStatusButtonProps) {
  const [status, setStatus] = useState<ReadingStatus>('none');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      readingProgressApi.get(bookId).then(res => {
        setStatus(res.progress?.status as ReadingStatus || 'none');
      }).catch(() => {
        // Fallback to localStorage
        setStatus(getStatuses()[bookId] || 'none');
      });
    } else {
      setStatus(getStatuses()[bookId] || 'none');
    }
  }, [bookId, isAuthenticated]);

  const handleChange = useCallback(async (newStatus: ReadingStatus) => {
    setStatus(newStatus);
    // Always save to localStorage as cache
    saveStatusLocal(bookId, newStatus);

    if (isAuthenticated) {
      try {
        if (newStatus === 'none') {
          await readingProgressApi.remove(bookId);
        } else {
          await readingProgressApi.update(bookId, { status: newStatus });
        }
      } catch {
        // localStorage already updated as fallback
      }
    }
  }, [bookId, isAuthenticated]);

  const current = STATUS_CONFIG[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {current ? (
          <Button
            variant="outline"
            size={size}
            className={cn(current.color, 'gap-2 font-medium', className)}
          >
            <current.icon className="h-4 w-4" />
            {current.label}
            <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size={size}
            className={cn('gap-2', className)}
          >
            <BookMarked className="h-4 w-4" />
            Add to Shelf
            <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onClick={() => handleChange('want-to-read')}
          className={cn(status === 'want-to-read' && 'bg-blue-50 dark:bg-blue-950')}
        >
          <BookMarked className="h-4 w-4 mr-2 text-blue-500" />
          Want to Read
          {status === 'want-to-read' && <CheckCircle2 className="h-3 w-3 ml-auto text-blue-500" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleChange('reading')}
          className={cn(status === 'reading' && 'bg-amber-50 dark:bg-amber-950')}
        >
          <BookOpen className="h-4 w-4 mr-2 text-amber-600" />
          Currently Reading
          {status === 'reading' && <CheckCircle2 className="h-3 w-3 ml-auto text-amber-600" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleChange('finished')}
          className={cn(status === 'finished' && 'bg-green-50 dark:bg-green-950')}
        >
          <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
          Finished
          {status === 'finished' && <CheckCircle2 className="h-3 w-3 ml-auto text-green-600" />}
        </DropdownMenuItem>
        {status !== 'none' && (
          <DropdownMenuItem onClick={() => handleChange('none')} className="text-muted-foreground">
            Remove from Shelf
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Hook to get all books with a specific reading status
 */
export function useReadingShelf() {
  const [statuses, setStatuses] = useState<Record<string, ReadingStatus>>({});
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      readingProgressApi.list(undefined, 1, 500).then(res => {
        const map: Record<string, ReadingStatus> = {};
        for (const item of res.items) {
          map[String(item.bookId)] = item.status as ReadingStatus;
        }
        setStatuses(map);
      }).catch(() => {
        setStatuses(getStatuses());
      });
    } else {
      setStatuses(getStatuses());
    }

    // Listen for changes from other tabs (localStorage fallback)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setStatuses(getStatuses());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [isAuthenticated]);

  return {
    statuses,
    wantToRead: Object.entries(statuses).filter(([, s]) => s === 'want-to-read').map(([id]) => id),
    reading: Object.entries(statuses).filter(([, s]) => s === 'reading').map(([id]) => id),
    finished: Object.entries(statuses).filter(([, s]) => s === 'finished').map(([id]) => id),
    total: Object.keys(statuses).length,
  };
}
