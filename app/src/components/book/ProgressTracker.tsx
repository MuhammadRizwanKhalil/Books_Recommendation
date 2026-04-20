import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { readingProgressApi, type ReadingProgressHistoryResponse, type ReadingProgressResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';

interface ProgressTrackerProps {
  bookId: string;
  totalPages?: number;
}

function formatLogDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function toPercent(currentPage: number | null, totalPages: number | null) {
  if (!currentPage || !totalPages || totalPages <= 0) return 0;
  return Math.max(0, Math.min(100, Number(((currentPage / totalPages) * 100).toFixed(2))));
}

function paceHeightClass(value: number | null | undefined) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  if (pct <= 5) return 'h-2';
  if (pct <= 15) return 'h-3';
  if (pct <= 25) return 'h-4';
  if (pct <= 35) return 'h-5';
  if (pct <= 45) return 'h-6';
  if (pct <= 55) return 'h-7';
  if (pct <= 65) return 'h-8';
  if (pct <= 75) return 'h-9';
  if (pct <= 85) return 'h-10';
  if (pct <= 95) return 'h-11';
  return 'h-12';
}

export function ProgressTracker({ bookId, totalPages: bookPageCount }: ProgressTrackerProps) {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<ReadingProgressResponse | null>(null);
  const [history, setHistory] = useState<ReadingProgressHistoryResponse[]>([]);
  const [pageInput, setPageInput] = useState('');
  const [percentInput, setPercentInput] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      setProgress(null);
      setHistory([]);
      return;
    }

    let active = true;
    setLoading(true);

    Promise.all([
      readingProgressApi.get(bookId),
      readingProgressApi.history(bookId),
    ])
      .then(([progressRes, historyRes]) => {
        if (!active) return;
        const nextProgress = progressRes.progress;
        setProgress(nextProgress);
        setHistory(historyRes.history || []);
        setPageInput(nextProgress?.currentPage != null ? String(nextProgress.currentPage) : '');
        setPercentInput(nextProgress?.percentage != null ? String(nextProgress.percentage) : '');
      })
      .catch(() => {
        if (!active) return;
        setProgress(null);
        setHistory([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookId, isAuthenticated]);

  const effectiveTotalPages = progress?.totalPages || bookPageCount || 0;
  const effectivePercentage = useMemo(() => {
    if (percentInput !== '') {
      const parsed = Number(percentInput);
      if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
    }
    if (progress?.percentage != null) return progress.percentage;
    return toPercent(progress?.currentPage ?? null, effectiveTotalPages || null);
  }, [percentInput, progress, effectiveTotalPages]);

  if (!isAuthenticated || loading || !progress || progress.status !== 'reading') {
    return null;
  }

  const onPageChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setPageInput(sanitized);
    const page = sanitized ? Number(sanitized) : 0;
    const pct = toPercent(page, effectiveTotalPages || null);
    setPercentInput(String(pct));
  };

  const saveUpdate = async () => {
    setSaving(true);
    setError(null);

    const currentPage = pageInput === '' ? undefined : Number(pageInput);
    const percentage = percentInput === '' ? undefined : Number(percentInput);

    if (currentPage !== undefined && effectiveTotalPages > 0 && currentPage > effectiveTotalPages) {
      setSaving(false);
      setError('Current page cannot exceed total pages.');
      return;
    }

    try {
      const updated = await readingProgressApi.updateTracker(bookId, {
        currentPage,
        percentage,
        note: note.trim() || undefined,
      });
      const historyRes = await readingProgressApi.history(bookId);
      setProgress(updated.progress);
      setHistory(historyRes.history || []);
      setNote('');
      setPageInput(updated.progress.currentPage != null ? String(updated.progress.currentPage) : '');
      setPercentInput(updated.progress.percentage != null ? String(updated.progress.percentage) : '');
    } catch (err: any) {
      setError(err?.message || 'Failed to update progress');
    } finally {
      setSaving(false);
    }
  };

  const markAsRead = async () => {
    setSaving(true);
    setError(null);
    try {
      const finish = await readingProgressApi.update(bookId, {
        status: 'finished',
        currentPage: effectiveTotalPages > 0 ? effectiveTotalPages : progress.currentPage,
      });
      setProgress(finish.progress);
    } catch (err: any) {
      setError(err?.message || 'Failed to mark as read');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-4 space-y-4" data-testid="progress-tracker" aria-label="Reading progress tracker">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm">Reading Progress</h3>
          <span className="text-xs text-muted-foreground">{effectivePercentage.toFixed(1)}%</span>
        </div>
        <div
          className="rounded-full bg-muted p-1"
          data-testid="progress-fill"
          data-progress={effectivePercentage.toFixed(1)}
          aria-hidden="true"
        >
          <div className="flex gap-0.5">
            {Array.from({ length: 20 }).map((_, index) => {
              const threshold = ((index + 1) / 20) * 100;
              const active = effectivePercentage >= threshold;
              return (
                <span
                  key={index}
                  className={`h-2 rounded-full ${active ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500' : 'bg-muted-foreground/20'}`}
                  aria-hidden="true"
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Page</span>
          <div className="flex items-center gap-2">
            <Input
              value={pageInput}
              onChange={(e) => onPageChange(e.target.value)}
              placeholder="0"
              inputMode="numeric"
              className="w-full"
              data-testid="progress-page-input"
              aria-label="Current page"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">of {effectiveTotalPages || '?'}</span>
          </div>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Percentage</span>
          <Input
            value={percentInput}
            onChange={(e) => setPercentInput(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            inputMode="decimal"
            className="w-full"
            data-testid="progress-percentage-input"
            aria-label="Progress percentage"
          />
        </label>
      </div>

      <label className="space-y-1 block text-sm">
        <span className="text-muted-foreground">Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          placeholder="What happened in this reading session?"
          className="w-full min-h-[88px] rounded-md border bg-background px-3 py-2 text-sm"
          data-testid="progress-note-input"
          aria-label="Progress note"
        />
      </label>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <Button
        onClick={saveUpdate}
        disabled={saving}
        className="w-full sm:w-auto bg-foreground text-background hover:bg-foreground/90"
        data-testid="progress-update-button"
      >
        Update Progress
      </Button>

      {effectivePercentage >= 100 && progress.status === 'reading' && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 flex items-center justify-between gap-3" data-testid="progress-mark-read-prompt">
          <div className="text-sm text-green-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Mark as Read?
          </div>
          <Button size="sm" onClick={markAsRead} disabled={saving} data-testid="progress-mark-read-button">Yes</Button>
        </div>
      )}

      <div className="space-y-2" data-testid="progress-history">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock3 className="h-4 w-4 text-muted-foreground" />
          Progress Timeline
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No updates yet.</p>
        ) : (
          <>
            <div className="flex items-end gap-1 h-12" aria-label="Reading pace chart">
              {history.slice(0, 12).reverse().map((item) => (
                <div
                  key={item.id}
                  className={`flex-1 rounded-t bg-gradient-to-t from-amber-300 to-orange-500 ${paceHeightClass(item.percentage)}`}
                  title={`${item.percentage ?? 0}%`}
                />
              ))}
            </div>
            <ul className="space-y-2">
              {history.slice(0, 8).map((item) => (
                <li key={item.id} className="rounded-md border p-2 text-xs space-y-1" data-testid="progress-history-item">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.currentPage ?? 0} pages</span>
                    <span className="text-muted-foreground">{(item.percentage ?? 0).toFixed(1)}%</span>
                  </div>
                  {item.note && <p className="text-muted-foreground">{item.note}</p>}
                  <p className="text-muted-foreground">{formatLogDate(item.loggedAt)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
