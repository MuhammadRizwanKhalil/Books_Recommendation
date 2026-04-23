import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Palette, Tag as TagIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, type TaggedBookResponse, type UserTagResponse, tagsApi } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSEO } from '@/hooks/useSEO';
import { FALLBACK_COVER, handleImgError } from '@/lib/imageUtils';
import { formatRating } from '@/lib/utils';

export function TagsPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [tags, setTags] = useState<UserTagResponse[]>([]);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [books, setBooks] = useState<TaggedBookResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [booksLoading, setBooksLoading] = useState(false);
  const [savingTagId, setSavingTagId] = useState<string | null>(null);
  const [draftColors, setDraftColors] = useState<Record<string, string>>({});

  useSEO({
    title: 'My Tags | The Book Times',
    description: 'Manage your private personal tags and browse books grouped by your own labels.',
  });

  const loadTags = useCallback(async () => {
    if (!isAuthenticated) {
      setTags([]);
      setBooks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await tagsApi.list();
      const items = response.tags || [];
      setTags(items);
      setDraftColors(Object.fromEntries(items.map((tag) => [tag.id, tag.color || '#4f46e5'])));

      if (items.length > 0) {
        const initialId = activeTagId && items.some((tag) => tag.id === activeTagId) ? activeTagId : items[0].id;
        setActiveTagId(initialId);
      } else {
        setActiveTagId(null);
      }
    } catch {
      toast.error('Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, [activeTagId, isAuthenticated]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const activeTag = useMemo(
    () => tags.find((tag) => tag.id === activeTagId) || null,
    [tags, activeTagId],
  );

  const loadBooksForTag = useCallback(async (tagId: string) => {
    try {
      setBooksLoading(true);
      const response = await tagsApi.booksByTag(tagId);
      setBooks(response.books || []);
    } catch {
      setBooks([]);
      toast.error('Failed to load books for tag');
    } finally {
      setBooksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeTagId || !isAuthenticated) {
      setBooks([]);
      return;
    }
    void loadBooksForTag(activeTagId);
  }, [activeTagId, isAuthenticated, loadBooksForTag]);

  async function updateTagColor(tag: UserTagResponse) {
    const color = draftColors[tag.id];
    if (!color) return;

    try {
      setSavingTagId(tag.id);
      const result = await tagsApi.update(tag.id, { color });
      setTags((prev) => prev.map((item) => (item.id === tag.id ? result.tag : item)));
      toast.success('Tag color updated');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update tag color';
      toast.error(message);
    } finally {
      setSavingTagId(null);
    }
  }

  async function deleteTag(tag: UserTagResponse) {
    try {
      await tagsApi.remove(tag.id);
      const nextTags = tags.filter((item) => item.id !== tag.id);
      setTags(nextTags);
      if (activeTagId === tag.id) {
        setActiveTagId(nextTags[0]?.id || null);
      }
      toast.success('Tag deleted');
    } catch {
      toast.error('Failed to delete tag');
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 pb-16" data-testid="tags-page-guest">
        <div className="max-w-2xl mx-auto rounded-2xl border bg-card p-8 text-center space-y-4">
          <TagIcon className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-3xl font-bold">My Tags</h1>
          <p className="text-muted-foreground">
            Build your own private taxonomy for books: comfort reads, book-club picks, vacation shelf, and more.
          </p>
          <Button onClick={() => openAuthModal('signin')}>Sign in to manage tags</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-16" data-testid="tags-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TagIcon className="h-6 w-6 text-primary" />
              My Tags
            </h1>
            <p className="text-muted-foreground mt-1">Private labels for organizing your reading world.</p>
          </div>
          <Badge variant="secondary">{tags.length} tags</Badge>
        </div>

        {loading ? (
          <div className="h-40 rounded-xl bg-muted animate-pulse" />
        ) : tags.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center space-y-3" data-testid="tags-empty">
            <TagIcon className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <h2 className="text-xl font-semibold">No tags yet</h2>
            <p className="text-muted-foreground">Open a book page and use Add Tag to create your first personal label.</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border bg-card p-4" data-testid="tag-cloud">
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const isActive = activeTagId === tag.id;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setActiveTagId(tag.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${isActive ? 'text-foreground border-primary bg-primary/10' : 'text-muted-foreground border-border hover:text-foreground'}`}
                      data-testid={`tag-filter-pill-${tag.id}`}
                    >
                      {tag.name} ({tag.bookCount})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              <section className="rounded-xl border bg-card p-4" data-testid="tagged-books-section">
                <h2 className="text-lg font-semibold mb-3">
                  {activeTag ? `Books tagged: ${activeTag.name}` : 'Tagged Books'}
                </h2>

                {booksLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="h-48 rounded-xl bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : books.length === 0 ? (
                  <p className="text-muted-foreground" data-testid="tagged-books-empty">No books in this tag yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="tagged-books-grid">
                    {books.map((book) => (
                      <article key={book.id} className="rounded-xl border bg-background p-3 space-y-2" data-testid="tagged-book-card">
                        <Link to={`/book/${book.slug}`} className="flex gap-3">
                          <img
                            src={book.coverImage || FALLBACK_COVER}
                            alt={`${book.title} cover`}
                            className="h-24 w-16 rounded-md border object-cover shrink-0"
                            onError={handleImgError}
                          />
                          <div className="min-w-0">
                            <h3 className="font-semibold line-clamp-2 hover:text-primary transition-colors">{book.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-1">{book.author}</p>
                            <p className="text-xs text-muted-foreground mt-1">Rating: {formatRating(book.googleRating)}</p>
                          </div>
                        </Link>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <aside className="rounded-xl border bg-card p-4 space-y-3" data-testid="tag-management-panel">
                <h2 className="text-lg font-semibold">Manage Tags</h2>
                <p className="text-sm text-muted-foreground">Customize color or delete a tag to remove it from all books.</p>

                {tags.map((tag) => (
                  <div key={tag.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{tag.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => void deleteTag(tag)}
                        data-testid={`tag-delete-button-${tag.id}`}
                        aria-label={`Delete tag ${tag.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="color"
                        className="h-8 w-10 rounded border bg-transparent p-1"
                        value={draftColors[tag.id] || '#4f46e5'}
                        onChange={(event) => {
                          setDraftColors((prev) => ({ ...prev, [tag.id]: event.target.value }));
                        }}
                        data-testid={`tag-color-edit-${tag.id}`}
                        aria-label={`Color for ${tag.name}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        onClick={() => void updateTagColor(tag)}
                        disabled={savingTagId === tag.id}
                        data-testid={`tag-save-button-${tag.id}`}
                      >
                        {savingTagId === tag.id ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                ))}
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
