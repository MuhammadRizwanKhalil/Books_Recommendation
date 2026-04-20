import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Loader2, Newspaper, Sparkles, Star, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { activityFeedApi, ApiError, type ActivityFeedItemResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { useSEO } from '@/hooks/useSEO';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type FeedFilter = 'all' | 'reviews' | 'ratings' | 'shelved';

const filterToTypes: Record<FeedFilter, string[] | undefined> = {
  all: undefined,
  reviews: ['review'],
  ratings: ['rating'],
  shelved: ['shelved', 'started', 'finished', 'dnf', 'progress'],
};

function describeActivity(activity: ActivityFeedItemResponse) {
  const bookTitle = activity.book?.title || 'a book';
  const rating = typeof activity.metadata?.rating === 'number' ? ` ${activity.metadata.rating}★` : '';

  switch (activity.type) {
    case 'review':
      return `${activity.user.name} reviewed ${bookTitle}`;
    case 'rating':
      return `${activity.user.name} rated ${bookTitle}${rating}`;
    case 'shelved':
      return `${activity.user.name} shelved ${bookTitle}`;
    case 'started':
      return `${activity.user.name} started ${bookTitle}`;
    case 'finished':
      return `${activity.user.name} finished ${bookTitle}`;
    case 'dnf':
      return `${activity.user.name} marked ${bookTitle} as DNF`;
    case 'progress':
      return `${activity.user.name} updated progress on ${bookTitle}`;
    case 'list_created':
      return `${activity.user.name} created a new list`;
    case 'challenge_set':
      return `${activity.user.name} set a reading challenge`;
    default:
      return `${activity.user.name} shared an update`;
  }
}

function renderMetaBadge(activity: ActivityFeedItemResponse) {
  switch (activity.type) {
    case 'review':
      return <Badge variant="secondary">Review</Badge>;
    case 'rating':
      return <Badge variant="secondary" className="gap-1"><Star className="h-3 w-3 fill-current" />{activity.metadata?.rating || 'Rated'}</Badge>;
    case 'finished':
      return <Badge variant="secondary">Finished</Badge>;
    case 'started':
      return <Badge variant="secondary">Started</Badge>;
    case 'shelved':
      return <Badge variant="secondary">Shelved</Badge>;
    case 'dnf':
      return <Badge variant="secondary">DNF</Badge>;
    default:
      return null;
  }
}

export function ActivityFeed() {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [activities, setActivities] = useState<ActivityFeedItemResponse[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useSEO({
    title: 'Activity Feed | The Book Times',
    description: 'See the latest reading activity, reviews, ratings, and shelf updates from readers you follow.',
  });

  const typeFilter = useMemo(() => filterToTypes[filter], [filter]);

  const loadFeed = useCallback(async (pageToLoad: number, reset = false) => {
    if (!isAuthenticated) {
      setActivities([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    try {
      if (pageToLoad === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const response = await activityFeedApi.list(pageToLoad, 5, typeFilter);
      setActivities((current) => {
        if (reset) return response.activities;
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...response.activities.filter((item) => !seen.has(item.id))];
      });
      setPage(pageToLoad);
      setHasMore(response.hasMore);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load your feed';
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [isAuthenticated, typeFilter]);

  useEffect(() => {
    setActivities([]);
    setPage(1);
    setHasMore(false);
    void loadFeed(1, true);
  }, [loadFeed]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loadingMore || loading) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry?.isIntersecting) {
        void loadFeed(page + 1);
      }
    }, { rootMargin: '150px' });

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadFeed, page]);

  if (!isAuthenticated || !user) {
    return (
      <div className="container mx-auto px-4 py-10" data-testid="activity-feed-page">
        <Card className="max-w-2xl mx-auto border-dashed">
          <CardContent className="py-12 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Newspaper className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Your Activity Feed</h1>
              <p className="text-muted-foreground">Sign in to follow readers and see their latest reviews, ratings, and shelf updates.</p>
            </div>
            <Button onClick={() => openAuthModal('signin')}>Sign in to continue</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" data-testid="activity-feed-page">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-1 text-sm font-medium text-background">
            <Sparkles className="h-4 w-4" />
            Social Feed
          </div>
          <h1 className="text-3xl font-bold">Reader Activity</h1>
          <p className="text-muted-foreground">Recent reviews, ratings, and shelf updates from people you follow.</p>
        </div>

        <div role="tablist" aria-label="Feed filters" className="flex flex-wrap gap-2">
          {(['all', 'reviews', 'ratings', 'shelved'] as FeedFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value ? 'true' : 'false'}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${filter === value ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground border-border hover:bg-accent'}`}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'All' : value === 'reviews' ? 'Reviews' : value === 'ratings' ? 'Ratings' : 'Shelved'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}><CardContent className="h-28 animate-pulse bg-muted/30" /></Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{error}</CardContent>
        </Card>
      ) : activities.length === 0 ? (
        <Card data-testid="activity-feed-empty">
          <CardContent className="py-12 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserPlus className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Follow readers to see their activity</h2>
              <p className="text-muted-foreground">Once you follow other readers, their reviews, ratings, and shelf changes will show up here.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <Card key={activity.id} data-testid="activity-card">
              <CardContent className="p-4 sm:p-5">
                <div className="flex gap-4">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={activity.user.avatarUrl || undefined} alt={activity.user.name} />
                    <AvatarFallback>{activity.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{describeActivity(activity)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {renderMetaBadge(activity)}
                    </div>

                    {activity.book ? (
                      <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                        {activity.book.coverImage ? (
                          <img
                            src={activity.book.coverImage}
                            alt={activity.book.title}
                            className="h-14 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-10 items-center justify-center rounded bg-muted text-muted-foreground">
                            <BookOpen className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <Link
                            to={activity.book.slug ? `/book/${activity.book.slug}` : '#'}
                            className="font-medium hover:text-primary"
                            data-testid="activity-book-link"
                          >
                            {activity.book.title}
                          </Link>
                        </div>
                      </div>
                    ) : null}

                    {typeof activity.metadata?.reviewExcerpt === 'string' && activity.metadata.reviewExcerpt ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">“{String(activity.metadata.reviewExcerpt)}”</p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div ref={sentinelRef} className="h-4" aria-hidden="true" />
          {loadingMore ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading more activity…
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default ActivityFeed;
