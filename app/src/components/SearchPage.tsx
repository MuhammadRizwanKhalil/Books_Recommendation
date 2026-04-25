import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ArrowUpDown, Grid3X3, List, BookOpen, Star, Heart, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { booksApi } from '@/api/client';

import { useCategories, useDebounce, useTopRated } from '@/hooks/useBooks';
import type { Book } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useSEO } from '@/hooks/useSEO';
import { mapBook } from '@/lib/mappers';
import { formatNumber, formatRating } from '@/lib/utils';
import { getSafeCoverImage, handleImgError } from '@/lib/imageUtils';
import { useWishlist } from '@/components/WishlistProvider';
import { StarDisplay } from '@/components/ui/star-display';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

type SortOption = { value: string; label: string; sort: string; order: 'asc' | 'desc' };

const sortOptions: SortOption[] = [
  { value: 'relevance', label: 'Most Relevant', sort: 'computed_score', order: 'desc' },
  { value: 'rating-desc', label: 'Highest Rated', sort: 'google_rating', order: 'desc' },
  { value: 'rating-asc', label: 'Lowest Rated', sort: 'google_rating', order: 'asc' },
  { value: 'newest', label: 'Newest First', sort: 'published_date', order: 'desc' },
  { value: 'oldest', label: 'Oldest First', sort: 'published_date', order: 'asc' },
  { value: 'title-asc', label: 'Title A-Z', sort: 'title', order: 'asc' },
  { value: 'title-desc', label: 'Title Z-A', sort: 'title', order: 'desc' },
  { value: 'popular', label: 'Most Popular', sort: 'ratings_count', order: 'desc' },
];

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';
  const initialSort = searchParams.get('sort') || 'relevance';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialMinRating = Number(searchParams.get('minRating') || '0');
  const initialYearFrom = searchParams.get('yearFrom') ? parseInt(searchParams.get('yearFrom') || '', 10) : undefined;
  const initialView = searchParams.get('view') === 'list' ? 'list' : 'grid';

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState(initialSort);
  const [minRating, setMinRating] = useState(initialMinRating);
  const [yearFrom, setYearFrom] = useState<number | undefined>(initialYearFrom);
  const [page, setPage] = useState(initialPage);
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialView);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const [books, setBooks] = useState<Book[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const { categories } = useCategories();
  const { books: topRatedBooks, loading: topRatedLoading } = useTopRated(20);
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { isAuthenticated, openAuthModal } = useAuth();
  const debouncedQuery = useDebounce(query, 300);

  useSEO({
    title: query ? `Search: "${query}" | The Book Times` : 'Search Books | The Book Times',
    description: query
      ? `Search results for "${query}" on The Book Times. Find books by title, author, or keyword.`
      : 'Search 50,000+ books by title, author, or keyword. Filter by category, rating, and more.',
    canonical: `${window.location.origin}/search${query ? `?q=${encodeURIComponent(query)}` : ''}`,
  });

  const currentSort = useMemo(() => sortOptions.find(s => s.value === sortBy) || sortOptions[0], [sortBy]);

  const fetchResults = useCallback(async (q: string, p: number) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await booksApi.list({
        search: q || undefined,
        page: p,
        limit: 20,
        sort: currentSort.sort,
        order: currentSort.order,
        category: category || undefined,
        minRating: minRating || undefined,
        yearFrom,
      });
      setBooks(res.books.map(mapBook));
      setPagination(res.pagination);
    } catch {
      setBooks([]);
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }, [currentSort, category, minRating, yearFrom]);

  // Sync URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedQuery) params.q = debouncedQuery;
    if (category) params.category = category;
    if (sortBy !== 'relevance') params.sort = sortBy;
    if (minRating > 0) params.minRating = String(minRating);
    if (yearFrom) params.yearFrom = String(yearFrom);
    if (viewMode === 'list') params.view = 'list';
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [debouncedQuery, category, sortBy, minRating, yearFrom, viewMode, page, setSearchParams]);

  // Fetch on param changes
  useEffect(() => {
    fetchResults(debouncedQuery, page);
  }, [debouncedQuery, page, fetchResults]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, category, sortBy, minRating, yearFrom]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setShowFilters(false);
      }

      if (sortMenuRef.current && !sortMenuRef.current.contains(target)) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  const activeFilterCount = [category, minRating, yearFrom].filter(Boolean).length;

  const clearFilters = () => {
    setCategory('');
    setMinRating(0);
    setYearFrom(undefined);
    setSortBy('relevance');
  };

  const handleWishlistAction = (book: Book) => {
    if (!isAuthenticated) {
      openAuthModal('signin');
      toast.info('Please sign in or create an account to use your wishlist.');
      return;
    }

    toggleWishlist(book);
  };

  return (
    <div className="min-h-screen pb-12">
      <div className="container mx-auto px-4">
        {/* Search Header */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by title, author, ISBN, or genre..."
              className="pl-12 pr-20 sm:pr-32 py-6 text-base sm:text-lg rounded-2xl shadow-md border-2 focus:border-primary"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query && (
                <Button variant="ghost" size="icon" onClick={() => setQuery('')} className="rounded-full">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Results Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            {hasSearched && !loading && (
              <p className="text-sm text-muted-foreground">
                {pagination.total === 0
                  ? 'No results found'
                  : <>Showing <span className="font-semibold text-foreground">{((page - 1) * 20) + 1}-{Math.min(page * 20, pagination.total)}</span> of <span className="font-semibold text-foreground">{pagination.total.toLocaleString()}</span> results</>
                }
                {query && <> for <span className="font-semibold text-foreground">"{query}"</span></>}
              </p>
            )}
            {/* Active filter badges */}
            {category && category.trim() && (
              <Badge variant="secondary" className="gap-1">
                {categories.find(c => c.slug === category)?.name || category}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setCategory('')} />
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div ref={filterMenuRef} className="relative rounded-xl border bg-card p-1 shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                className="relative h-9 rounded-lg px-3"
                onClick={() => {
                  setShowFilters((current) => !current);
                  setShowSortMenu(false);
                }}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute left-0 top-full z-50 mt-2 w-[min(92vw,22rem)] origin-top-left rounded-2xl border bg-card p-5 shadow-xl"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Filters</h3>
                      {activeFilterCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                          <X className="mr-1 h-3 w-3" /> Clear all
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Category</label>
                        <Select value={category || '__all__'} onValueChange={(val) => setCategory(val === '__all__' ? '' : val)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="All Categories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">All Categories</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Min Rating: {minRating ? `${minRating}+` : 'Any'}
                        </label>
                        <Slider
                          min={0}
                          max={5}
                          step={0.5}
                          value={[minRating]}
                          onValueChange={([val]) => setMinRating(val)}
                          className="pt-2"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Published After</label>
                        <Select
                          value={yearFrom?.toString() || '__any__'}
                          onValueChange={(val) => setYearFrom(val === '__any__' ? undefined : parseInt(val, 10))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Any Year" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__any__">Any Year</SelectItem>
                            {(() => { const y = new Date().getFullYear(); return [y, y-1, y-2, y-3, y-5, y-10, y-20]; })().map((year) => (
                              <SelectItem key={year} value={year.toString()}>After {year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div ref={sortMenuRef} className="relative rounded-xl border bg-card p-1 shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-lg px-3"
                onClick={() => {
                  setShowSortMenu((current) => !current);
                  setShowFilters(false);
                }}
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                {currentSort.label}
              </Button>

              <AnimatePresence>
                {showSortMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute left-0 top-full z-50 mt-2 min-w-[220px] origin-top-left rounded-2xl border bg-card p-2 shadow-xl"
                  >
                    {sortOptions.map((opt) => (
                      <Button
                        key={opt.value}
                        variant={sortBy === opt.value ? 'secondary' : 'ghost'}
                        className="h-9 w-full justify-start rounded-xl px-3 text-sm"
                        onClick={() => {
                          setSortBy(opt.value);
                          setShowSortMenu(false);
                        }}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center rounded-xl border bg-card p-1 shadow-sm">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-9 rounded-lg px-3"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="mr-2 h-4 w-4" />
                Card View
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-9 rounded-lg px-3"
                onClick={() => setViewMode('list')}
              >
                <List className="mr-2 h-4 w-4" />
                List View
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[2/3] rounded-2xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl border bg-card p-3">
                  <div className="flex gap-3">
                    <Skeleton className="h-24 w-16 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : query.trim().length > 0 && query.trim().length < 3 ? (
          // Professional: require minimum 3 characters
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full bg-yellow-500/10 mb-4">
              <Search className="h-10 w-10 text-yellow-600 dark:text-yellow-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Search term too short</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Please enter at least 3 characters for accurate search results.
            </p>
            <Button variant="outline" onClick={() => setQuery('')}>Clear</Button>
          </div>
        ) : books.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6 xl:gap-5">
              {books.map((book, index) => (
                <SearchGridCard
                  key={book.id}
                  book={book}
                  rank={(page - 1) * pagination.limit + index + 1}
                  liked={isInWishlist(book.id)}
                  onToggleWishlist={() => handleWishlistAction(book)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 xl:gap-4">
              {books.map((book) => (
                <SearchListCard
                  key={book.id}
                  book={book}
                  isExpanded={expandedBookId === book.id}
                  onMouseEnter={() => setExpandedBookId(book.id)}
                  onMouseLeave={() => setExpandedBookId((current) => (current === book.id ? null : current))}
                  liked={isInWishlist(book.id)}
                  onToggleWishlist={() => handleWishlistAction(book)}
                />
              ))}
            </div>
          )
        ) : hasSearched ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <BookOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No books found</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              {query 
                ? `We couldn't find any books matching "${query}". Try adjusting your search terms or filters.`
                : 'Try searching for a book title, author, or genre.'
              }
            </p>
            <div className="flex gap-3">
              {query && (
                <Button variant="outline" onClick={() => setQuery('')}>Clear Search</Button>
              )}
              {activeFilterCount > 0 && (
                <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <Search className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Search our library</h3>
            <p className="text-muted-foreground max-w-md">
              Enter at least 3 characters for a book title, author name, or keywords.
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(7, pagination.totalPages) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= pagination.totalPages - 3) {
                pageNum = pagination.totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'outline'}
                  size="sm"
                  className="w-9"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        )}

        {!topRatedLoading && topRatedBooks.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative mt-16"
            style={{ zIndex: 0 }}
          >
            <AutoFlipCarousel
              books={topRatedBooks}
              title="Top 20 Overall"
              subtitle="Highest rated books across all categories"
              loading={topRatedLoading}
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
            />
          </motion.section>
        )}
      </div>
    </div>
  );
}

function SearchGridCard({
  book,
  rank,
  liked,
  onToggleWishlist,
}: {
  book: Book;
  rank: number;
  liked: boolean;
  onToggleWishlist: () => void;
}) {
  return (
    <Card className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/95 py-0 gap-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/30">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleWishlist();
        }}
        className="absolute left-2 top-2 z-20 rounded-full bg-background/90 p-1.5 shadow-sm backdrop-blur-sm transition hover:bg-background"
        title={liked ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart className={`h-4 w-4 ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
      </button>

      <Link to={`/book/${book.slug || book.id}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          <img
            src={getSafeCoverImage(book.coverImage)}
            alt={`${book.title} by ${book.author}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={handleImgError}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute right-2 top-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            #{rank}
          </div>
          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {formatRating(book.googleRating)}
          </div>
        </div>

        <CardContent className="space-y-1.5 p-3">
          <p className="line-clamp-2 text-xs font-semibold leading-tight transition-colors group-hover:text-primary sm:text-sm">
            {book.title}
          </p>
          <p className="line-clamp-1 text-[11px] text-muted-foreground sm:text-xs">{book.author}</p>
          <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground sm:text-[11px]">
            {book.description || 'No description available for this title yet.'}
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="line-clamp-1 text-[10px] font-medium text-primary/80 sm:text-[11px]">
              {book.categories?.[0] || 'General'}
            </p>
            <p className="text-[10px] text-muted-foreground">{formatNumber(book.ratingsCount)} ratings</p>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground sm:text-[11px]">
            <span>{book.publishedDate ? new Date(book.publishedDate).getFullYear() || 'Unknown' : 'Unknown year'}</span>
            <span className="font-medium text-primary/80">Score {Math.round(book.computedScore || 0)}</span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

function SearchListCard({
  book,
  isExpanded,
  onMouseEnter,
  onMouseLeave,
  liked,
  onToggleWishlist,
}: {
  book: Book;
  isExpanded: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  liked: boolean;
  onToggleWishlist: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (isExpanded && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setPanelRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    } else {
      setPanelRect(null);
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;

    const update = () => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setPanelRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [isExpanded]);

  return (
    <div
      ref={cardRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="group rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-lg"
    >
      <div className="flex items-center gap-3 p-3 sm:p-3.5">
        <Link to={`/book/${book.slug || book.id}`} className="shrink-0">
          <div className="h-24 w-16 overflow-hidden rounded-xl bg-muted shadow-sm sm:h-28 sm:w-[74px]">
            <img
              src={getSafeCoverImage(book.coverImage)}
              alt={`${book.title} by ${book.author}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={handleImgError}
            />
          </div>
        </Link>

        <div className="min-w-0 flex-1">
          <Link to={`/book/${book.slug || book.id}`} className="block">
            <h3 className="line-clamp-1 text-sm font-semibold transition-colors group-hover:text-primary sm:text-base">
              {book.title}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground sm:text-sm">{book.author}</p>
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {formatRating(book.googleRating)}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatNumber(book.ratingsCount)} ratings</span>
            {book.categories?.[0] && (
              <span className="line-clamp-1 text-[11px] font-medium text-primary/80">{book.categories[0]}</span>
            )}
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleWishlist();
          }}
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
        </Button>
      </div>

      {isExpanded && panelRect && createPortal(
        <AnimatePresence>
          <motion.div
            key={book.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
              position: 'fixed',
              top: panelRect.top,
              left: panelRect.left,
              width: panelRect.width,
              zIndex: 99999,
            }}
          >
            <div className="space-y-3 rounded-xl border bg-card p-3 shadow-2xl sm:p-4">
              <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {book.description || 'Open the book details page to read more about this title, discover reviews, and explore related books.'}
              </p>
              <div className="flex items-center gap-2">
                <StarDisplay rating={book.googleRating || 0} size="xs" />
                <span className="text-xs font-medium">{formatRating(book.googleRating)}</span>
                <span className="text-[11px] text-muted-foreground">({formatNumber(book.ratingsCount)})</span>
              </div>
              {book.categories?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {book.categories.slice(0, 4).map((category) => (
                    <Badge key={category} variant="outline" className="text-[10px]">
                      {category}
                    </Badge>
                  ))}
                </div>
              )}
              <Button asChild size="sm" className="h-8 rounded-full px-4 text-xs">
                <Link to={`/book/${book.slug || book.id}`}>Open Book Details</Link>
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function AutoFlipCarousel({
  books,
  title,
  subtitle,
  icon,
  loading = false,
}: {
  books: Book[];
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const posRef = useRef<number>(0);
  const halfWidthRef = useRef<number>(0);

  const displayBooks = books.length > 0 ? [...books, ...books] : [];

  useEffect(() => {
    const track = trackRef.current;
    if (!track || books.length === 0) return;

    const measure = () => {
      halfWidthRef.current = track.scrollWidth / 2;
    };
    measure();
    window.addEventListener('resize', measure, { passive: true });

    const animate = (time: number) => {
      if (lastTimeRef.current > 0) {
        const delta = Math.min(time - lastTimeRef.current, 100);
        posRef.current += 0.45 * (delta / 16);
        if (halfWidthRef.current > 0 && posRef.current >= halfWidthRef.current) {
          posRef.current -= halfWidthRef.current;
        }
        track.style.transform = `translateX(-${posRef.current}px)`;
      }
      lastTimeRef.current = time;
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', measure);
    };
  }, [books.length]);

  if (loading) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-2">
          {icon}
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[140px] shrink-0 sm:w-[160px]">
              <div className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (books.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
        <div className="overflow-hidden">
          <div
            ref={trackRef}
            className="flex gap-4 will-change-transform"
            onMouseEnter={() => {
              lastTimeRef.current = 0;
            }}
            onMouseLeave={() => {
              lastTimeRef.current = 0;
            }}
            onTouchStart={() => {
              lastTimeRef.current = 0;
            }}
            onTouchEnd={() => {
              lastTimeRef.current = 0;
            }}
          >
            {displayBooks.map((book, idx) => (
              <Link
                key={`${book.id}-${idx}`}
                to={`/book/${book.slug || book.id}`}
                className="group/flip w-[140px] shrink-0 cursor-pointer sm:w-[160px]"
                style={{ perspective: '1000px' }}
              >
                <div className="relative aspect-[2/3] w-full transition-transform duration-500 [transform-style:preserve-3d] group-hover/flip:[transform:rotateY(180deg)]">
                  <div className="absolute inset-0 overflow-hidden rounded-xl shadow-md [backface-visibility:hidden]">
                    <img
                      src={getSafeCoverImage(book.coverImage)}
                      alt={book.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={handleImgError}
                    />
                  </div>
                  <div className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-3 shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <div className="space-y-1.5 overflow-hidden">
                      <h4 className="line-clamp-2 text-xs font-bold">{book.title}</h4>
                      <p className="text-[11px] text-muted-foreground">{book.author}</p>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium">{formatRating(book.googleRating)}</span>
                      </div>
                      <p className="line-clamp-4 text-[10px] leading-relaxed text-muted-foreground">{book.description}</p>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between border-t pt-1.5">
                      <span />
                      <span className="text-[10px] font-medium text-primary">View ?</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
