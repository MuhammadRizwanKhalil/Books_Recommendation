import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Clock3, GripVertical, ListOrdered, PlayCircle, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { readingProgressApi, tbrQueueApi, type ReadingProgressResponse, type TBRQueueItemResponse, ApiError } from '@/api/client';
import { useSEO } from '@/hooks/useSEO';

const MAX_QUEUE_ITEMS = 10;

export function TBRQueuePage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [queue, setQueue] = useState<TBRQueueItemResponse[]>([]);
  const [wantToRead, setWantToRead] = useState<ReadingProgressResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [saving, setSaving] = useState(false);
  const [draggedBookId, setDraggedBookId] = useState<string | null>(null);
  const [touchDraggedBookId, setTouchDraggedBookId] = useState<string | null>(null);

  useSEO({
    title: 'Up Next Queue | The Book Times',
    description: 'Prioritize the next books you actually plan to read with your Up Next queue.',
  });

  const availableWantToRead = useMemo(() => {
    const queued = new Set(queue.map((item) => item.bookId));
    return wantToRead.filter((item) => !queued.has(item.bookId));
  }, [queue, wantToRead]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [queueResponse, progressResponse] = await Promise.all([
        tbrQueueApi.list(),
        readingProgressApi.list('want-to-read', 1, 100),
      ]);
      setQueue(queueResponse.items || []);
      setWantToRead(progressResponse.items || []);
    } catch {
      toast.error('Failed to load your Up Next queue');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleAddBook() {
    if (!selectedBookId) return;

    if (queue.length >= MAX_QUEUE_ITEMS) {
      toast.error('Your Up Next queue can only hold 10 books');
      return;
    }

    try {
      setSaving(true);
      const response = await tbrQueueApi.add(selectedBookId);
      setQueue((prev) => [...prev, response.item].sort((a, b) => a.position - b.position));
      setSelectedBookId('');
      toast.success(response.message || 'Book added to your queue');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to add book';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(bookId: string) {
    try {
      await tbrQueueApi.remove(bookId);
      const next = queue.filter((item) => item.bookId !== bookId).map((item, index) => ({ ...item, position: index + 1 }));
      setQueue(next);
      toast.success('Removed from your Up Next queue');
    } catch {
      toast.error('Failed to remove book');
    }
  }

  async function handleStartReading(bookId: string) {
    try {
      await readingProgressApi.update(bookId, { status: 'reading' });
      setQueue((prev) => prev.filter((item) => item.bookId !== bookId).map((item, index) => ({ ...item, position: index + 1 })));
      setWantToRead((prev) => prev.filter((item) => item.bookId !== bookId));
      toast.success('Moved into Currently Reading');
    } catch {
      toast.error('Failed to start reading');
    }
  }

  async function persistOrder(nextQueue: TBRQueueItemResponse[]) {
    setQueue(nextQueue.map((item, index) => ({ ...item, position: index + 1 })));
    try {
      await tbrQueueApi.reorder(nextQueue.map((item) => item.bookId));
    } catch {
      toast.error('Failed to reorder queue');
      await loadData();
    }
  }

  async function moveItem(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= queue.length) return;
    const next = [...queue];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    await persistOrder(next);
  }

  async function handleDrop(targetBookId: string) {
    if (!draggedBookId || draggedBookId === targetBookId) {
      setDraggedBookId(null);
      return;
    }

    const fromIndex = queue.findIndex((item) => item.bookId === draggedBookId);
    const toIndex = queue.findIndex((item) => item.bookId === targetBookId);
    setDraggedBookId(null);
    await moveItem(fromIndex, toIndex);
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 pb-16">
        <div className="max-w-2xl mx-auto rounded-2xl border bg-card p-8 text-center space-y-4">
          <ListOrdered className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-3xl font-bold">Up Next Queue</h1>
          <p className="text-muted-foreground">
            Keep your next reads intentional with a focused queue of up to 10 books.
          </p>
          <Button onClick={() => openAuthModal('signin')}>Sign in to use your queue</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-16" data-testid="tbr-queue-page">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Clock3 className="h-6 w-6 text-primary" />
              Up Next Queue
            </h1>
            <p className="text-muted-foreground mt-1">
              Prioritize the books you actually want to read next.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit">{queue.length}/{MAX_QUEUE_ITEMS} books queued</Badge>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label htmlFor="up-next-select" className="text-sm font-medium md:min-w-40">
              Add from Want to Read
            </label>
            <select
              id="up-next-select"
              aria-label="Add from Want to Read"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedBookId}
              onChange={(event) => setSelectedBookId(event.target.value)}
            >
              <option value="">Select a book</option>
              {availableWantToRead.map((item) => (
                <option key={item.bookId} value={item.bookId}>
                  {item.title} — {item.author}
                </option>
              ))}
            </select>
            <Button onClick={handleAddBook} disabled={!selectedBookId || saving}>
              Add Book
            </Button>
          </div>
          {queue.length >= MAX_QUEUE_ITEMS && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Your Up Next queue can only hold 10 books.
            </p>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-28 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center space-y-3">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <h2 className="text-xl font-semibold">Add books to your Up Next queue</h2>
            <p className="text-muted-foreground">
              Pick up to 10 titles from your Want to Read shelf and reorder them anytime.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item, index) => (
              <article
                key={item.bookId}
                data-testid={`tbr-queue-item-${item.bookId}`}
                draggable
                onDragStart={() => setDraggedBookId(item.bookId)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void handleDrop(item.bookId)}
                onTouchStart={() => setTouchDraggedBookId(item.bookId)}
                onTouchEnd={() => {
                  if (touchDraggedBookId && touchDraggedBookId !== item.bookId) {
                    void handleDrop(item.bookId);
                  }
                  setTouchDraggedBookId(null);
                }}
                className="rounded-xl border bg-card p-4 shadow-sm"
              >
                <div data-testid="tbr-queue-item" className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GripVertical className="h-5 w-5" />
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                    </div>
                    <img
                      src={item.coverImage}
                      alt={`${item.title} cover`}
                      className="h-20 w-14 rounded-md object-cover border"
                    />
                    <div className="min-w-0 flex-1">
                      <Link to={`/book/${item.slug}`} className="font-semibold hover:text-primary transition-colors">
                        {item.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">{item.author}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">Position {index + 1}</Badge>
                        {item.pageCount ? <Badge variant="secondary">{item.pageCount} pages</Badge> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <Button variant="outline" size="icon" aria-label={`Move ${item.title} up`} onClick={() => void moveItem(index, index - 1)} disabled={index === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" aria-label={`Move ${item.title} down`} onClick={() => void moveItem(index, index + 1)} disabled={index === queue.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" data-testid={`tbr-start-reading-${item.bookId}`} onClick={() => void handleStartReading(item.bookId)}>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Start Reading
                    </Button>
                    <Button variant="ghost" size="icon" data-testid={`tbr-remove-${item.bookId}`} aria-label={`Remove ${item.title}`} onClick={() => void handleRemove(item.bookId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const TBRQueue = TBRQueuePage;
