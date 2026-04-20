import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Star, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { booksApi, type FriendsActivityResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface FriendsReadingThisProps {
  bookId: string;
}

function getStatusLabel(status?: string | null) {
  switch (status) {
    case 'reading':
      return 'Currently reading';
    case 'read':
    case 'finished':
      return 'Read';
    case 'dnf':
      return 'Did not finish';
    case 'rated':
      return 'Rated';
    case 'reviewed':
      return 'Reviewed';
    default:
      return 'Interacted';
  }
}

export function FriendsReadingThis({ bookId }: FriendsReadingThisProps) {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<FriendsActivityResponse | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    if (!isAuthenticated) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    booksApi.getFriendsActivity(bookId)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch(() => {
        if (alive) setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [bookId, isAuthenticated]);

  const summaryText = useMemo(() => {
    if (!data || data.totalFriends === 0) return '';

    const readingCount = data.friends.filter((entry) => entry.status === 'reading').length;
    const ratedCount = data.friends.filter((entry) => typeof entry.rating === 'number').length;

    if (readingCount > 0) {
      return `${readingCount} ${readingCount === 1 ? 'friend is' : 'friends are'} reading this`;
    }

    if (ratedCount > 0) {
      return `${ratedCount} ${ratedCount === 1 ? 'friend rated this' : 'friends rated this'}`;
    }

    return `${data.totalFriends} ${data.totalFriends === 1 ? 'friend has interacted with this book' : 'friends have interacted with this book'}`;
  }, [data]);

  if (!isAuthenticated || loading || !data || data.totalFriends === 0) {
    return null;
  }

  const visibleFriends = data.friends.slice(0, 5);
  const remainingCount = Math.max(0, data.totalFriends - visibleFriends.length);

  return (
    <Card className="border-primary/20 bg-primary/5" data-testid="friends-reading-section">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <Users className="h-4 w-4" />
                <h3 className="text-lg font-semibold text-foreground">Friends Reading This</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {summaryText}
                {data.friendsAvgRating > 0 ? ` — ${data.friendsAvgRating.toFixed(1)} avg` : ''}
              </p>
            </div>

            <div className="flex items-center gap-3" data-testid="friends-reading-avatars">
              <div className="flex -space-x-2">
                {visibleFriends.map((entry) => (
                  <Link key={entry.user.id} to={`/users/${entry.user.id}`} data-testid="friend-profile-link">
                    <Avatar className="h-8 w-8 border-2 border-background sm:h-9 sm:w-9">
                      <AvatarImage src={entry.user.avatarUrl || undefined} alt={entry.user.name} />
                      <AvatarFallback>{entry.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Link>
                ))}
              </div>
              {remainingCount > 0 ? (
                <Badge variant="secondary">+{remainingCount} more</Badge>
              ) : null}
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 self-start"
            onClick={() => setExpanded((value) => !value)}
            data-testid="friends-reading-toggle"
          >
            {expanded ? 'Hide details' : 'See details'}
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {expanded ? (
          <div className="mt-4 space-y-2" data-testid="friends-reading-list">
            {data.friends.map((entry) => (
              <Link
                key={`${entry.user.id}-${entry.reviewId || entry.status || 'friend'}`}
                to={`/users/${entry.user.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background/80 p-3 transition-colors hover:bg-background"
                data-testid="friend-profile-link"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={entry.user.avatarUrl || undefined} alt={entry.user.name} />
                    <AvatarFallback>{entry.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{entry.user.name}</p>
                    <p className="text-xs text-muted-foreground">{getStatusLabel(entry.status)}</p>
                  </div>
                </div>

                {typeof entry.rating === 'number' ? (
                  <div className="flex items-center gap-1 text-sm font-medium text-amber-600">
                    <Star className="h-4 w-4 fill-current" />
                    {entry.rating.toFixed(1)}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default FriendsReadingThis;
