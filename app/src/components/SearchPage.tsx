import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ArrowUpDown, Grid3X3, List, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookGrid } from '@/components/book/BookGrid';
import { booksApi } from '@/api/client';

import { useCategories, useDebounce } from '@/hooks/useBooks';
import type { Book } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useSEO } from '@/hooks/useSEO';
import { mapBook } from '@/lib/mappers';

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

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState(initialSort);
  const [minRating, setMinRating] = useState(0);
  const [yearFrom, setYearFrom] = useState<number | undefined>();
  const [page, setPage] = useState(initialPage);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [books, setBooks] = useState<Book[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const { categories } = useCategories();
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
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [debouncedQuery, category, sortBy, page, setSearchParams]);

  // Fetch on param changes
  useEffect(() => {
    fetchResults(debouncedQuery, page);
  }, [debouncedQuery, page, fetchResults]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, category, sortBy, minRating, yearFrom]);

  const activeFilterCount = [category, minRating, yearFrom].filter(Boolean).length;

  const clearFilters = () => {
    setCategory('');
    setMinRating(0);
    setYearFrom(undefined);
    setSortBy('relevance');
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
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full relative"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 p-5 bg-card rounded-2xl shadow-md border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Filters</h3>
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                        <X className="h-3 w-3 mr-1" /> Clear all
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                        value={yearFrom?.toString() || ''}
                        onValueChange={(val) => setYearFrom(val ? parseInt(val) : undefined)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Any Year" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=" ">Any Year</SelectItem>
                          {(() => { const y = new Date().getFullYear(); return [y, y-1, y-2, y-3, y-5, y-10, y-20]; })().map((year) => (
                            <SelectItem key={year} value={year.toString()}>After {year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 w-[180px]">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[2/3] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
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
          <BookGrid books={books} loading={false} columns={viewMode === 'list' ? 2 : 4} />
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
      </div>
    </div>
  );
}
