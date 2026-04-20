import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { editionsApi } from '@/api/client';
import type { EditionResponse } from '@/api/client';

interface Props {
  bookId: string;
}

const FORMAT_LABELS: Record<string, string> = {
  hardcover: 'Hardcover',
  paperback: 'Paperback',
  ebook: 'eBook',
  audiobook: 'Audiobook',
  large_print: 'Large Print',
  mass_market: 'Mass Market',
};

const ALL_FILTER = 'all';

export function EditionsBrowser({ bookId }: Props) {
  const [editions, setEditions] = useState<EditionResponse[]>([]);
  const [workTitle, setWorkTitle] = useState<string | null>(null);
  const [totalEditions, setTotalEditions] = useState(0);
  const [countLoaded, setCountLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<string>(ALL_FILTER);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    editionsApi.list(bookId)
      .then((data) => {
        setEditions(data.editions);
        setWorkTitle(data.workTitle);
        setTotalEditions(data.totalEditions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [expanded, bookId]);

  // Pre-fetch count on mount
  useEffect(() => {
    editionsApi.list(bookId).then((data) => {
      setTotalEditions(data.totalEditions);
      setWorkTitle(data.workTitle);
    }).catch(() => {}).finally(() => setCountLoaded(true));
  }, [bookId]);

  if (!countLoaded || totalEditions === 0) return null;

  const availableFormats = [...new Set(editions.map((e) => e.format).filter(Boolean))] as string[];
  const filtered = filter === ALL_FILTER ? editions : editions.filter((e) => e.format === filter);

  return (
    <section
      className="border rounded-xl overflow-hidden"
      data-testid="editions-browser"
      aria-label="Other Editions"
    >
      {/* Header / trigger */}
      <Button
        type="button"
        variant="ghost"
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors h-auto rounded-none"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        data-testid="editions-toggle"
      >
        <span className="font-semibold text-sm flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {workTitle ? `${workTitle} — ` : ''}
          <span data-testid="editions-count">All Editions ({totalEditions})</span>
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </Button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Format filter */}
          {availableFormats.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by format">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilter(ALL_FILTER)}
                aria-pressed={filter === ALL_FILTER}
                className={
                  filter === ALL_FILTER
                    ? 'bg-foreground text-background hover:bg-foreground/90 border-foreground'
                    : ''
                }
                data-testid="editions-filter-all"
              >
                All
              </Button>
              {availableFormats.map((fmt) => (
                <Button
                  key={fmt}
                  variant="outline"
                  size="sm"
                  onClick={() => setFilter(fmt)}
                  aria-pressed={filter === fmt}
                  className={
                    filter === fmt
                      ? 'bg-foreground text-background hover:bg-foreground/90 border-foreground'
                      : ''
                  }
                  data-testid={`editions-filter-${fmt}`}
                >
                  {FORMAT_LABELS[fmt] ?? fmt}
                </Button>
              ))}
            </div>
          )}

          {loading && (
            <p className="text-sm text-muted-foreground" aria-live="polite">Loading editions…</p>
          )}

          {/* Editions grid */}
          {!loading && (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
              data-testid="editions-grid"
            >
              {filtered.map((edition) => (
                <button
                  key={edition.id}
                  type="button"
                  className="flex flex-col gap-2 rounded-lg border p-2 hover:bg-accent transition-colors text-left focus:outline-none focus:ring-2 focus:ring-ring"
                  onClick={() => navigate(`/book/${edition.slug}`)}
                  data-testid="edition-card"
                  aria-label={`${edition.title}${edition.format ? `, ${FORMAT_LABELS[edition.format] ?? edition.format}` : ''}`}
                >
                  {edition.coverImage ? (
                    <img
                      src={edition.coverImage}
                      alt={`Cover of ${edition.title}`}
                      className="w-full aspect-[2/3] object-cover rounded"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-muted rounded flex items-center justify-center">
                      <BookOpen className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                    </div>
                  )}
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-medium leading-tight line-clamp-2">{edition.title}</p>
                    {edition.format && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        {FORMAT_LABELS[edition.format] ?? edition.format}
                      </Badge>
                    )}
                    {(edition.publisher || edition.year) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[edition.publisher, edition.year].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">No editions found for this filter.</p>
          )}
        </div>
      )}
    </section>
  );
}
