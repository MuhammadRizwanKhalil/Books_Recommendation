import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpen, Star, Calendar, FileText, Globe2, DollarSign,
  ArrowLeft, Plus, X, BarChart3, Trophy,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { booksApi, type BookResponse } from '@/api/client';
import { useSEO } from '@/hooks/useSEO';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const MAX_COMPARE = 3;

export function BookComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [books, setBooks] = useState<(BookResponse | null)[]>([null, null]);
  const [loading, setLoading] = useState<boolean[]>([false, false]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingSlot, setAddingSlot] = useState<number | null>(null);

  useSEO({
    title: 'Compare Books | The Book Times',
    description: 'Compare books side-by-side â€” ratings, page count, price, publish date, and more.',
  });

  // Load books from URL params on mount
  useEffect(() => {
    const slugs = searchParams.getAll('book');
    if (slugs.length > 0) {
      const newBooks: (BookResponse | null)[] = new Array(Math.max(slugs.length, 2)).fill(null);
      const newLoading = new Array(newBooks.length).fill(false);
      slugs.forEach((slug, i) => {
        if (!slug) return;
        newLoading[i] = true;
        setLoading([...newLoading]);
        booksApi.getBySlug(slug)
          .then(book => {
            setBooks(prev => {
              const updated = [...prev];
              while (updated.length <= i) updated.push(null);
              updated[i] = book;
              return updated;
            });
          })
          .catch(() => {})
          .finally(() => {
            setLoading(prev => {
              const updated = [...prev];
              updated[i] = false;
              return updated;
            });
          });
      });
      setBooks(newBooks);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateUrlParams = (updatedBooks: (BookResponse | null)[]) => {
    const params = new URLSearchParams();
    updatedBooks.forEach(b => {
      if (b) params.append('book', b.slug);
    });
    setSearchParams(params, { replace: true });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const result = await booksApi.list({ search: searchQuery.trim(), limit: 8 });
      setSearchResults(result.books);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectBook = (book: BookResponse) => {
    if (addingSlot === null) return;
    setBooks(prev => {
      const updated = [...prev];
      updated[addingSlot] = book;
      updateUrlParams(updated);
      return updated;
    });
    setAddingSlot(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveBook = (index: number) => {
    setBooks(prev => {
      const updated = [...prev];
      updated[index] = null;
      // Keep at least 2 slots
      if (updated.filter(Boolean).length === 0) return [null, null];
      updateUrlParams(updated);
      return updated;
    });
  };

  const handleAddSlot = () => {
    if (books.length >= MAX_COMPARE) {
      toast.info(`Maximum ${MAX_COMPARE} books can be compared`);
      return;
    }
    setBooks(prev => [...prev, null]);
    setAddingSlot(books.length);
  };

  const activeBooks = books.filter(Boolean) as BookResponse[];
  const bestRated = activeBooks.length >= 2
    ? activeBooks.reduce((best, b) => (b.googleRating ?? 0) > (best.googleRating ?? 0) ? b : best)
    : null;
  const bestScore = activeBooks.length >= 2
    ? activeBooks.reduce((best, b) => (b.computedScore ?? 0) > (best.computedScore ?? 0) ? b : best)
    : null;

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 pt-20 pb-12 md:pt-24">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Link>
          </Button>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-serif">Compare Books</h1>
              <p className="text-muted-foreground text-sm">Side-by-side comparison of up to {MAX_COMPARE} books</p>
            </div>
          </div>

          {/* Hint when no books are selected */}
          {activeBooks.length === 0 && addingSlot === null && (
            <div className="mb-6 p-4 rounded-xl bg-muted/50 border border-border/50 text-center">
              <p className="text-sm text-muted-foreground">
                Click a slot below to search and add books. Compare ratings, page count, price, and more side-by-side.
              </p>
            </div>
          )}

          {/* Comparison Grid */}
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${books.length}, minmax(0, 1fr))` }}>
            {books.map((book, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                {loading[index] ? (
                  <Card className="p-6">
                    <Skeleton className="w-full aspect-[2/3] rounded-lg mb-4" />
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </Card>
                ) : book ? (
                  <Card className="h-full relative group">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      onClick={() => handleRemoveBook(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <CardContent className="p-4 space-y-4">
                      {/* Cover */}
                      <Link to={`/book/${book.slug}`} className="block">
                        <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted shadow-md mx-auto max-w-[160px]">
                          {book.coverImage ? (
                            <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/20">
                              <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                      </Link>

                      {/* Title */}
                      <div className="text-center">
                        <Link to={`/book/${book.slug}`} className="hover:text-primary transition-colors">
                          <h3 className="font-semibold text-sm line-clamp-2">{book.title}</h3>
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">{book.author}</p>
                      </div>

                      {/* Comparison rows */}
                      <div className="divide-y text-sm">
                        <CompareRow
                          icon={<Star className="h-3.5 w-3.5 text-yellow-500" />}
                          label="Rating"
                          value={
                            book.googleRating
                              ? `${book.googleRating} â˜… (${book.ratingsCount.toLocaleString()})`
                              : 'N/A'
                          }
                          highlight={bestRated?.id === book.id}
                        />
                        <CompareRow
                          icon={<Trophy className="h-3.5 w-3.5 text-primary" />}
                          label="Score"
                          value={book.computedScore?.toFixed(1) || 'N/A'}
                          highlight={bestScore?.id === book.id}
                        />
                        <CompareRow
                          icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                          label="Pages"
                          value={book.pageCount ? book.pageCount.toLocaleString() : 'N/A'}
                        />
                        <CompareRow
                          icon={<DollarSign className="h-3.5 w-3.5 text-green-600" />}
                          label="Price"
                          value={book.price ? `${book.currency === 'USD' ? '$' : book.currency}${book.price.toFixed(2)}` : 'N/A'}
                        />
                        <CompareRow
                          icon={<Calendar className="h-3.5 w-3.5 text-muted-foreground" />}
                          label="Published"
                          value={book.publishedDate?.substring(0, 4) || 'N/A'}
                        />
                        <CompareRow
                          icon={<Globe2 className="h-3.5 w-3.5 text-muted-foreground" />}
                          label="Language"
                          value={book.language?.toUpperCase() || 'N/A'}
                        />
                        <CompareRow
                          icon={<BookOpen className="h-3.5 w-3.5 text-muted-foreground" />}
                          label="Publisher"
                          value={book.publisher || 'N/A'}
                        />
                      </div>

                      {/* Categories */}
                      {book.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {book.categories.slice(0, 3).map(c => (
                            <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0 rounded-full">{c}</Badge>
                          ))}
                        </div>
                      )}

                      {/* Action link */}
                      {book.amazonUrl && (
                        <div className="text-center pt-1">
                          <a
                            href={book.amazonUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View on Amazon â†’
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  /* Empty slot */
                  <Card
                    className="h-full border-dashed flex items-center justify-center min-h-[300px] cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => setAddingSlot(index)}
                  >
                    <div className="text-center p-6">
                      <Plus className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Add a book</p>
                    </div>
                  </Card>
                )}
              </motion.div>
            ))}

            {/* Add slot button */}
            {books.length < MAX_COMPARE && activeBooks.length >= 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Card
                  className="h-full border-dashed flex items-center justify-center min-h-[300px] cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                  onClick={handleAddSlot}
                >
                  <div className="text-center p-6">
                    <Plus className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Add another book</p>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Search panel */}
          {addingSlot !== null && (
            <motion.div
              className="mt-8 max-w-lg mx-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-6">
                <h3 className="font-semibold mb-3">Search for a book to compare</h3>
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Search books by title or author..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    autoFocus
                  />
                  <Button onClick={handleSearch} disabled={searching}>
                    {searching ? 'Searching...' : 'Search'}
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map(book => (
                      <div
                        key={book.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => handleSelectBook(book)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && handleSelectBook(book)}
                      >
                        <div className="w-10 h-14 rounded overflow-hidden bg-muted shrink-0">
                          {book.coverImage && (
                            <img src={book.coverImage} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{book.title}</p>
                          <p className="text-xs text-muted-foreground">{book.author}</p>
                        </div>
                        {book.googleRating && (
                          <div className="flex items-center gap-0.5 text-xs">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            {book.googleRating}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setAddingSlot(null); setSearchResults([]); }}>
                    Cancel
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareRow({ icon, label, value, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 px-1 ${highlight ? 'bg-yellow-50 dark:bg-yellow-900/10 -mx-1 px-2 rounded' : ''}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className={`text-xs font-medium ${highlight ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
        {value}
        {highlight && ' ðŸ‘‘'}
      </span>
    </div>
  );
}

export default BookComparePage;
