import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, LibraryBig, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ApiError, ownedBooksApi, type OwnedBookFormat, type OwnedBookResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { useSEO } from '@/hooks/useSEO';

const FILTERS: Array<OwnedBookFormat | 'all'> = ['all', 'hardcover', 'paperback', 'ebook', 'audiobook'];

function formatLabel(format: OwnedBookFormat | 'all') {
  if (format === 'all') return 'All Formats';
  if (format === 'hardcover') return 'Hardcover';
  if (format === 'paperback') return 'Paperback';
  if (format === 'ebook') return 'eBook';
  return 'Audiobook';
}

export function OwnedBooksPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const hasToken = typeof window !== 'undefined' && !!window.localStorage.getItem('thebooktimes-token');
  const [items, setItems] = useState<OwnedBookResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<OwnedBookFormat | 'all'>('all');
  const [statusMessage, setStatusMessage] = useState('');

  useSEO({
    title: 'Owned Books | The Book Times',
    description: 'Track books you own by format and manage your personal home library.',
  });

  const loadOwned = useCallback(async () => {
    if (!isAuthenticated && !hasToken) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await ownedBooksApi.list();
      setItems(response.items || []);
    } catch {
      toast.error('Failed to load owned books');
    } finally {
      setLoading(false);
    }
  }, [hasToken, isAuthenticated]);

  useEffect(() => {
    void loadOwned();
  }, [loadOwned]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter((item) => item.format === activeFilter);
  }, [items, activeFilter]);

  async function handleRemove(itemId: string) {
    try {
      await ownedBooksApi.remove(itemId);
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setStatusMessage('Removed from owned books.');
      toast.success('Removed from owned books');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to remove owned entry';
      toast.error(message);
    }
  }

  if (!isAuthenticated && !hasToken) {
    return (
      <div className="container mx-auto px-4 py-8 pb-16" data-testid="owned-books-page">
        <div className="max-w-2xl mx-auto rounded-2xl border bg-card p-8 text-center space-y-4">
          <LibraryBig className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-3xl font-bold">Owned Books</h1>
          <p className="text-muted-foreground">
            Build your personal library by format and keep track of every copy you own.
          </p>
          <Button onClick={() => openAuthModal('signin')}>Sign in to manage owned books</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-16" data-testid="owned-books-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpenCheck className="h-6 w-6 text-primary" />
              Owned Books
            </h1>
            <p className="text-muted-foreground mt-1">Track what is already on your shelves and devices.</p>
          </div>
          <Badge variant="secondary" className="w-fit">{items.length} copies tracked</Badge>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <Button
                key={filter}
                variant={activeFilter === filter ? 'default' : 'outline'}
                size="sm"
                data-testid={filter === 'all' ? 'owned-filter-all' : `owned-filter-${filter}`}
                onClick={() => setActiveFilter(filter)}
              >
                {formatLabel(filter)}
              </Button>
            ))}
          </div>
        </div>

        {statusMessage ? <p className="text-sm text-muted-foreground">{statusMessage}</p> : null}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-44 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center space-y-3">
            <LibraryBig className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <h2 className="text-xl font-semibold">No owned books in this filter yet</h2>
            <p className="text-muted-foreground">Open any book page and use the I Own This button to start your library.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <article key={item.id} data-testid="owned-book-card" className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex gap-3 min-w-0">
                  <img
                    src={item.coverImage || 'https://placehold.co/280x420?text=Book'}
                    alt={`${item.title || 'Book'} cover`}
                    className="h-24 w-16 rounded-md border object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    {item.slug ? (
                      <Link to={`/book/${item.slug}`} className="font-semibold hover:text-primary transition-colors line-clamp-2">
                        {item.title}
                      </Link>
                    ) : (
                      <p className="font-semibold line-clamp-2">{item.title || 'Unknown book'}</p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-1">{item.author || 'Unknown author'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{formatLabel(item.format)}</Badge>
                      {item.isLendable ? <Badge variant="secondary">Lendable</Badge> : null}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => void handleRemove(item.id)}
                  data-testid="owned-remove-button"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove from owned
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
