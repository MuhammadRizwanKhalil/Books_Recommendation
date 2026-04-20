import { useEffect, useState } from 'react';
import { BookCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { ApiError, ownedBooksApi, type OwnedBookFormat } from '@/api/client';
import { cn } from '@/lib/utils';

interface OwnedBookButtonProps {
  bookId: string;
  className?: string;
}

const ALL_FORMATS: OwnedBookFormat[] = ['hardcover', 'paperback', 'ebook', 'audiobook'];

function formatLabel(format: OwnedBookFormat) {
  if (format === 'audiobook') return 'Audiobook';
  if (format === 'hardcover') return 'Hardcover';
  if (format === 'paperback') return 'Paperback';
  return 'eBook';
}

export function OwnedBookButton({ bookId, className }: OwnedBookButtonProps) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const hasToken = typeof window !== 'undefined' && !!window.localStorage.getItem('thebooktimes-token');
  const hasSession = isAuthenticated || hasToken;
  const [formats, setFormats] = useState<OwnedBookFormat[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasSession) {
      setFormats([]);
      return;
    }

    ownedBooksApi.getOwnership(bookId)
      .then((response) => setFormats(response.formats || []))
      .catch(() => setFormats([]));
  }, [bookId, hasSession]);

  async function handleAddFormat(format: OwnedBookFormat) {
    if (!hasSession) {
      openAuthModal('signin');
      return;
    }

    setLoading(true);
    try {
      await ownedBooksApi.add({ bookId, format });
      setFormats((prev) => (prev.includes(format) ? prev : [...prev, format]));
      setOpen(false);
      toast.success('Added to your owned books');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFormats((prev) => (prev.includes(format) ? prev : [...prev, format]));
        toast.message('You already track that format');
      } else {
        const message = error instanceof ApiError ? error.message : 'Failed to track owned book';
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Button
        variant={formats.length > 0 ? 'default' : 'outline'}
        className="w-full gap-2"
        onClick={() => {
          if (!hasSession) {
            openAuthModal('signin');
            return;
          }
          setOpen((prev) => !prev);
        }}
        data-testid="own-this-trigger"
      >
        {formats.length > 0 ? <CheckCircle2 className="h-4 w-4" /> : <BookCheck className="h-4 w-4" />}
        {formats.length > 0 ? 'You Own This' : 'I Own This'}
      </Button>

      {open && (
        <div className="rounded-xl border bg-card p-3" aria-label="Select owned format">
          <div className="grid grid-cols-2 gap-2">
            {ALL_FORMATS.map((format) => {
              const active = formats.includes(format);
              return (
                <Button
                  key={format}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className="justify-start"
                  disabled={loading}
                  data-testid={`own-format-${format}`}
                  onClick={() => void handleAddFormat(format)}
                >
                  {formatLabel(format)}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {formats.length > 0 && (
        <div
          className="inline-flex min-h-8 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
          data-testid="owned-book-badge"
        >
          You own this: {formats.map((format) => formatLabel(format)).join(', ')}
        </div>
      )}
    </div>
  );
}
