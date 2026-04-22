import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText, NotebookPen, Quote } from 'lucide-react';
import { toast } from 'sonner';
import { journalApi, type JournalEntryResponse, type JournalEntryType } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSEO } from '@/hooks/useSEO';
import { cn } from '@/lib/utils';

const filters: Array<{ value: 'all' | JournalEntryType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'note', label: 'Notes' },
  { value: 'quote', label: 'Quotes' },
  { value: 'highlight', label: 'Highlights' },
  { value: 'reaction', label: 'Reactions' },
];

export function JournalPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [entries, setEntries] = useState<JournalEntryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | JournalEntryType>('all');

  useSEO({
    title: 'Reading Journal | The Book Times',
    description: 'Review your personal reading notes, highlights, reactions, and quotes across all books.',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    journalApi.list()
      .then((result) => setEntries(result.entries || []))
      .catch(() => {
        setEntries([]);
        toast.error('Failed to load journal entries');
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter !== 'all' && entry.entryType !== filter) return false;
      if (!q) return true;

      const haystack = [
        entry.content,
        entry.chapter || '',
        entry.book?.title || '',
        entry.book?.author || '',
      ].join(' ').toLowerCase();

      return haystack.includes(q);
    });
  }, [entries, filter, query]);

  if (!isAuthenticated) {
    return (
      <main data-testid="journal-page-guest">
        <div className="container mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
          <NotebookPen className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-3xl font-bold">My Reading Journal</h1>
          <p className="text-muted-foreground">Sign in to see your notes, highlights, reactions, and saved quotes.</p>
          <Button onClick={() => openAuthModal('signin')}>Sign in to open journal</Button>
        </div>
      </main>
    );
  }

  return (
    <main data-testid="journal-page">
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <section className="rounded-2xl border bg-card p-6 space-y-3">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <NotebookPen className="h-7 w-7 text-primary" />
            My Reading Journal
          </h1>
          <p className="text-muted-foreground">A single stream of your private notes and shareable quotes across all books.</p>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
            <Input
              placeholder="Search content, chapter, title, author..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              data-testid="journal-search"
            />
            <select
              aria-label="Filter journal entries by type"
              className="h-10 rounded-md border bg-background px-2 text-sm"
              value={filter}
              onChange={(event) => setFilter(event.target.value as 'all' | JournalEntryType)}
              data-testid="journal-filter"
            >
              {filters.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
        </section>

        {loading ? (
          <div className="h-40 rounded-xl bg-muted animate-pulse" data-testid="journal-loading" />
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center" data-testid="journal-empty">
            <p className="text-muted-foreground">No journal entries match your filter.</p>
          </div>
        ) : (
          <section className="space-y-3" data-testid="journal-list">
            {filteredEntries.map((entry) => (
              <article key={entry.id} className="rounded-xl border bg-card p-4 space-y-3" data-testid={`journal-entry-${entry.id}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="capitalize">{entry.entryType}</Badge>
                    {entry.pageNumber && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <BookOpenText className="h-3 w-3" /> p.{entry.pageNumber}
                      </span>
                    )}
                    {entry.chapter && <span className="text-xs text-muted-foreground">{entry.chapter}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>

                <p className={cn('text-sm leading-relaxed whitespace-pre-wrap', entry.entryType === 'quote' && 'italic')}>
                  {entry.entryType === 'quote' ? (
                    <span className="inline-flex items-start gap-1"><Quote className="h-3 w-3 mt-1 shrink-0" /> {entry.content}</span>
                  ) : entry.content}
                </p>

                {entry.book && (
                  <Link
                    to={`/book/${entry.book.slug}`}
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    data-testid={`journal-entry-book-${entry.id}`}
                  >
                    <img
                      src={entry.book.coverImage || 'https://placehold.co/80x120?text=Book'}
                      alt={entry.book.title}
                      className="h-10 w-7 rounded object-cover border"
                    />
                    <span>{entry.book.title} by {entry.book.author}</span>
                  </Link>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
