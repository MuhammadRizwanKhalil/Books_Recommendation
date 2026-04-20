import { useState, useEffect, useCallback } from 'react';
import { BookOpen, CheckCircle2, BookMarked, ChevronDown, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { readingProgressApi } from '@/api/client';

type ReadingStatus = 'none' | 'want-to-read' | 'reading' | 'finished' | 'dnf';

const STATUS_CONFIG: Record<ReadingStatus, { label: string; icon: typeof BookOpen; color: string } | null> = {
  'none': null,
  'want-to-read': { label: 'Want to Read', icon: BookMarked, color: 'text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' },
  'reading': { label: 'Currently Reading', icon: BookOpen, color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800' },
  'finished': { label: 'Finished', icon: CheckCircle2, color: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' },
  'dnf': { label: 'Did Not Finish', icon: Ban, color: 'text-red-500 bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' },
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
  const [showDnfForm, setShowDnfForm] = useState(false);
  const [dnfPercentage, setDnfPercentage] = useState<number>(0);
  const [dnfReason, setDnfReason] = useState<string>('');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      readingProgressApi.get(bookId).then(res => {
        const s = res.progress?.status as ReadingStatus || 'none';
        setStatus(s);
        if (s === 'dnf' && res.progress) {
          setDnfPercentage(res.progress.dnfPercentage ?? 0);
          setDnfReason(res.progress.dnfReason ?? '');
        }
      }).catch(() => {
        setStatus(getStatuses()[bookId] || 'none');
      });
    } else {
      setStatus(getStatuses()[bookId] || 'none');
    }
  }, [bookId, isAuthenticated]);

  const handleChange = useCallback(async (newStatus: ReadingStatus, extraData?: { dnfPercentage?: number; dnfReason?: string }) => {
    setStatus(newStatus);
    saveStatusLocal(bookId, newStatus);

    if (isAuthenticated) {
      try {
        if (newStatus === 'none') {
          await readingProgressApi.remove(bookId);
        } else {
          await readingProgressApi.update(bookId, {
            status: newStatus,
            ...(newStatus === 'dnf' && extraData ? { dnfPercentage: extraData.dnfPercentage, dnfReason: extraData.dnfReason } : {}),
          });
        }
      } catch {
        // localStorage already updated as fallback
      }
    }
  }, [bookId, isAuthenticated]);

  const handleDnfSelect = useCallback(() => {
    setShowDnfForm(true);
  }, []);

  const handleDnfSubmit = useCallback(() => {
    handleChange('dnf', { dnfPercentage, dnfReason: dnfReason || undefined });
    setShowDnfForm(false);
  }, [handleChange, dnfPercentage, dnfReason]);

  const current = STATUS_CONFIG[status];

  return (
    <>
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
      <DropdownMenuContent align="start" className="w-56">
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
        <DropdownMenuItem
          onClick={handleDnfSelect}
          className={cn(status === 'dnf' && 'bg-red-50 dark:bg-red-950')}
          data-testid="dnf-menu-item"
        >
          <Ban className="h-4 w-4 mr-2 text-red-500" />
          Did Not Finish
          {status === 'dnf' && <CheckCircle2 className="h-3 w-3 ml-auto text-red-500" />}
        </DropdownMenuItem>
        {status !== 'none' && (
          <DropdownMenuItem onClick={() => handleChange('none')} className="text-muted-foreground">
            Remove from Shelf
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    {/* DNF Sub-form Dialog */}
    {showDnfForm && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={() => setShowDnfForm(false)}
        data-testid="dnf-form-overlay"
      >
        <div
          className="bg-card border rounded-xl p-5 w-80 max-w-[90vw] shadow-xl space-y-4"
          onClick={(e) => e.stopPropagation()}
          data-testid="dnf-form"
        >
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Ban className="h-4 w-4 text-red-500" />
            Did Not Finish
          </h3>

          <div className="space-y-2">
            <label htmlFor="dnf-percentage" className="text-sm font-medium">
              How far did you get?
            </label>
            <div className="flex items-center gap-3">
              <input
                id="dnf-percentage"
                type="range"
                min={0}
                max={100}
                value={dnfPercentage}
                onChange={(e) => setDnfPercentage(parseInt(e.target.value, 10))}
                className="flex-1 accent-red-500"
                aria-label="Percentage completed"
                data-testid="dnf-percentage-slider"
              />
              <span className="text-sm font-mono w-10 text-right" data-testid="dnf-percentage-value">
                {dnfPercentage}%
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="dnf-reason" className="text-sm font-medium">
              Reason (optional)
            </label>
            <textarea
              id="dnf-reason"
              value={dnfReason}
              onChange={(e) => setDnfReason(e.target.value.slice(0, 500))}
              placeholder="Why did you stop reading?"
              maxLength={500}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              data-testid="dnf-reason-textarea"
            />
            <p className="text-xs text-muted-foreground text-right">{dnfReason.length}/500</p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDnfForm(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDnfSubmit}
              data-testid="dnf-submit-btn"
            >
              Mark as DNF
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
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
    dnf: Object.entries(statuses).filter(([, s]) => s === 'dnf').map(([id]) => id),
    total: Object.keys(statuses).length,
  };
}
