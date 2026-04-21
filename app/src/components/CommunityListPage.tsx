import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Eye, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { communityListsApi, type CommunityListDetailResponse, type CommunityListItemResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { useSEO } from '@/hooks/useSEO';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { handleImgError } from '@/lib/imageUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function CommunityListPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [list, setList] = useState<CommunityListDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBookId, setSavingBookId] = useState<string | null>(null);

  useSEO({
    title: list ? `${list.name} | Community Book List | The Book Times` : 'Community Book List | The Book Times',
    description: list?.description || 'Community-voted book ranking on The Book Times.',
  });

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);

    communityListsApi.get(id)
      .then((data) => {
        if (!active) return;
        setList(data);
      })
      .catch((err: any) => {
        if (!active) return;
        toast.error(err?.message || 'Failed to load community list');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const rankedItems = useMemo(
    () => [...(list?.items || [])].sort((a, b) => (b.voteScore - a.voteScore) || (a.sortOrder - b.sortOrder)),
    [list],
  );

  const handleVote = async (item: CommunityListItemResponse, vote: 1 | -1) => {
    if (!list) return;

    if (!isAuthenticated) {
      openAuthModal('signin');
      toast.info('Sign in to vote on community lists');
      return;
    }

    setSavingBookId(item.bookId);
    try {
      const result = await communityListsApi.vote(list.id, item.bookId, vote);
      setList((prev) => {
        if (!prev) return prev;
        const updatedItems = prev.items
          .map((entry) => entry.bookId === item.bookId
            ? {
                ...entry,
                userVote: result.currentVote,
                voteScore: result.voteScore,
                upvotes: result.upvotes,
                downvotes: result.downvotes,
              }
            : entry)
          .sort((a, b) => (b.voteScore - a.voteScore) || (a.sortOrder - b.sortOrder));

        return { ...prev, voteCount: result.listVoteCount, items: updatedItems };
      });
      toast.success(result.currentVote === 0 ? 'Vote removed' : 'Vote recorded');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record vote');
    } finally {
      setSavingBookId(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full max-w-xl" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!list) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Community list not found</h1>
        <Button asChild className="mt-4">
          <Link to="/lists/discover">Back to discovery</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl" data-testid="community-list-detail-page">
      <Button variant="ghost" asChild className="mb-4 -ml-2">
        <Link to="/lists/discover">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to discover
        </Link>
      </Button>

      <div className="mb-8 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" /> Community list
          </Badge>
          {list.isFeatured && <Badge>Featured</Badge>}
        </div>
        <h1 className="mt-3 text-3xl font-bold font-serif">{list.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">by {list.userName || 'Community member'}</p>
        {list.description && <p className="mt-3 max-w-2xl text-muted-foreground">{list.description}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <BookOpen className="h-3 w-3" /> {list.bookCount} {list.bookCount === 1 ? 'book' : 'books'}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ThumbsUp className="h-3 w-3" /> {list.voteCount} votes
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Eye className="h-3 w-3" /> {list.viewCount} views
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {rankedItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.03 }}
          >
            <Card data-testid={`community-list-book-row-${item.bookId}`}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}
                  </div>
                  <Link to={`/book/${item.slug}`} className="block h-20 w-14 overflow-hidden rounded-md bg-muted shadow-sm">
                    {item.coverImage ? (
                      <img src={item.coverImage} alt={item.title} className="h-full w-full object-cover" onError={handleImgError} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><BookOpen className="h-5 w-5 text-muted-foreground" /></div>
                    )}
                  </Link>
                </div>

                <div className="min-w-0 flex-1">
                  <Link to={`/book/${item.slug}`} className="font-semibold hover:text-primary">
                    {item.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">{item.author}</p>
                  {item.categories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.categories.slice(0, 3).map((category) => (
                        <Badge key={category} variant="secondary" className="text-[11px]">{category}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <p className="text-lg font-bold">{item.voteScore}</p>
                    <p className="text-xs text-muted-foreground">score</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant={item.userVote === 1 ? 'default' : 'outline'}
                      disabled={savingBookId === item.bookId}
                      onClick={() => handleVote(item, 1)}
                      aria-label={`Upvote ${item.title}`}
                      data-testid="vote-up-button"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant={item.userVote === -1 ? 'destructive' : 'outline'}
                      disabled={savingBookId === item.bookId}
                      onClick={() => handleVote(item, -1)}
                      aria-label={`Downvote ${item.title}`}
                      data-testid="vote-down-button"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.upvotes} up · {item.downvotes} down
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default CommunityListPage;
