import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, ExternalLink, Newspaper } from 'lucide-react';
import { Link } from 'react-router-dom';
import { booksApi, type BlogMention } from '@/api/client';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

interface FeaturedInBlogProps {
  bookId: string;
}

export function FeaturedInBlog({ bookId }: FeaturedInBlogProps) {
  const [mentions, setMentions] = useState<BlogMention[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    booksApi.getBlogMentions(bookId)
      .then((response) => {
        if (!active) return;
        setMentions(response.mentions || []);
      })
      .catch(() => {
        if (!active) return;
        setMentions([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookId]);

  const visibleMentions = useMemo(
    () => (expanded ? mentions : mentions.slice(0, 3)),
    [expanded, mentions],
  );

  if (loading || mentions.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="featured-in-blog-heading" className="space-y-4" data-testid="featured-in-blog-section">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h2 id="featured-in-blog-heading" className="text-xl font-semibold text-foreground">
              Featured In
            </h2>
            <p className="text-sm text-muted-foreground">
              This book appears in {mentions.length} blog {mentions.length === 1 ? 'post' : 'posts'}
            </p>
          </div>
        </div>

        {mentions.length > 3 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls="featured-in-blog-list"
          >
            {expanded ? 'Show less' : 'View all'}
            {expanded ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
          </Button>
        )}
      </div>

      <div id="featured-in-blog-list" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleMentions.map((mention) => (
          <article
            data-testid="featured-blog-card"
            key={mention.id}
            className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md"
          >
            {mention.featuredImage ? (
              <img
                src={mention.featuredImage}
                alt={mention.title}
                className="h-40 w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex h-40 items-center justify-center bg-muted text-muted-foreground">
                <Newspaper className="h-8 w-8" aria-hidden="true" />
              </div>
            )}

            <div className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{mention.publishedAt ? formatDate(mention.publishedAt) : 'Recently published'}</span>
              </div>

              <h3 className="line-clamp-2 text-base font-semibold">{mention.title}</h3>
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {mention.excerpt || 'Read the full post to see how this book was featured.'}
              </p>

              <Button asChild variant="ghost" className="px-0 text-primary hover:text-primary">
                <Link to={`/blog/${mention.slug}`} aria-label={`Read blog post: ${mention.title}`}>
                  Read blog post
                  <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
