import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ReviewFiltersState {
  q: string;
  rating: number | undefined;
  sort: string;
  hasSpoiler: boolean | undefined;
}

interface ReviewFiltersProps {
  totalReviews: number;
  totalFiltered: number;
  onFiltersChange: (filters: ReviewFiltersState) => void;
  isFiltering: boolean;
}

const STAR_OPTIONS = [
  { label: 'All', value: 0 },
  { label: '5★', value: 5 },
  { label: '4★', value: 4 },
  { label: '3★', value: 3 },
  { label: '2★', value: 2 },
  { label: '1★', value: 1 },
];

export function ReviewFilters({ totalReviews, totalFiltered, onFiltersChange, isFiltering }: ReviewFiltersProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedRating, setSelectedRating] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState('helpful');
  const [spoilerFilter, setSpoilerFilter] = useState<boolean | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters = !!searchText || selectedRating !== undefined || spoilerFilter !== undefined;

  const emitFilters = useCallback((q: string, rating: number | undefined, sort: string, hasSpoiler: boolean | undefined) => {
    onFiltersChange({ q, rating, sort, hasSpoiler });
  }, [onFiltersChange]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      emitFilters(value, selectedRating, sortBy, spoilerFilter);
    }, 300);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleRatingChange = (rating: number) => {
    const newRating = rating === 0 ? undefined : (selectedRating === rating ? undefined : rating);
    setSelectedRating(newRating);
    emitFilters(searchText, newRating, sortBy, spoilerFilter);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    emitFilters(searchText, selectedRating, sort, spoilerFilter);
  };

  const handleSpoilerToggle = () => {
    const next = spoilerFilter === undefined ? false : (spoilerFilter === false ? true : undefined);
    setSpoilerFilter(next);
    emitFilters(searchText, selectedRating, sortBy, next);
  };

  const clearAll = () => {
    setSearchText('');
    setSelectedRating(undefined);
    setSortBy('helpful');
    setSpoilerFilter(undefined);
    emitFilters('', undefined, 'helpful', undefined);
  };

  return (
    <div className="space-y-3" data-testid="review-filters">
      {/* Mobile toggle */}
      <div className="sm:hidden">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between text-xs"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter & Search Reviews
          </span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              Active
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter controls — always visible on desktop, collapsible on mobile */}
      <div className={`space-y-3 ${expanded ? '' : 'hidden sm:block'}`}>
        {/* Search + Sort row */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search reviews..."
              value={searchText}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 h-8 text-sm"
              maxLength={200}
              aria-label="Search reviews"
              data-testid="review-search-input"
            />
            {searchText && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs" data-testid="review-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="helpful">Most Helpful</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="highest">Highest Rated</SelectItem>
              <SelectItem value="lowest">Lowest Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Star filter buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STAR_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={
                (opt.value === 0 && selectedRating === undefined) || selectedRating === opt.value
                  ? 'default'
                  : 'outline'
              }
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => handleRatingChange(opt.value)}
              aria-pressed={
                (opt.value === 0 && selectedRating === undefined) || selectedRating === opt.value
              }
              data-testid={`rating-filter-${opt.value}`}
            >
              {opt.label}
            </Button>
          ))}
          <Button
            variant={spoilerFilter !== undefined ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5 ml-2"
            onClick={handleSpoilerToggle}
            aria-pressed={spoilerFilter !== undefined}
            data-testid="spoiler-filter"
          >
            {spoilerFilter === undefined ? 'Spoilers' : spoilerFilter ? 'With Spoilers' : 'No Spoilers'}
          </Button>
        </div>
      </div>

      {/* Active filter pills + count */}
      {(hasActiveFilters || isFiltering) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground" data-testid="filtered-count">
            {totalFiltered} of {totalReviews} review{totalReviews !== 1 ? 's' : ''}{' '}
            {hasActiveFilters ? 'matching filters' : ''}
          </span>

          {searchText && (
            <Badge variant="secondary" className="text-xs gap-1 h-5 pl-2 pr-1">
              Search: &ldquo;{searchText}&rdquo;
              <button onClick={() => handleSearchChange('')} aria-label="Remove search filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedRating !== undefined && (
            <Badge variant="secondary" className="text-xs gap-1 h-5 pl-2 pr-1">
              {selectedRating}★ only
              <button onClick={() => handleRatingChange(0)} aria-label="Remove rating filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {spoilerFilter !== undefined && (
            <Badge variant="secondary" className="text-xs gap-1 h-5 pl-2 pr-1">
              {spoilerFilter ? 'With' : 'No'} Spoilers
              <button onClick={() => { setSpoilerFilter(undefined); emitFilters(searchText, selectedRating, sortBy, undefined); }} aria-label="Remove spoiler filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs px-1.5"
              onClick={clearAll}
              data-testid="clear-all-filters"
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
