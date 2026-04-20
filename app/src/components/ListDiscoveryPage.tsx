import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search, Sparkles, ThumbsUp, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { communityListsApi, type CommunityListResponse } from '@/api/client';
import { useSEO } from '@/hooks/useSEO';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export function ListDiscoveryPage() {
  const [lists, setLists] = useState<CommunityListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'popular' | 'newest' | 'featured'>('popular');

  useSEO({
    title: 'Community Book Lists | The Book Times',
    description: 'Browse community-voted book lists inspired by Goodreads Listopia — discover the best sci-fi, romance, tearjerkers, and more.',
  });

  useEffect(() => {
    let active = true;
    setLoading(true);

    communityListsApi.discover({ page: 1, limit: 24, sort, search })
      .then((data) => {
        if (!active) return;
        setLists(data.lists);
      })
      .catch((err: any) => {
        if (!active) return;
        toast.error(err?.message || 'Failed to load community lists');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sort, search]);

  const featuredLists = useMemo(() => lists.filter((list) => list.isFeatured).slice(0, 3), [lists]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl" data-testid="community-lists-page">
      <div className="mb-8 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-8">
        <Badge variant="secondary" className="mb-3 gap-1">
          <Sparkles className="h-3.5 w-3.5" /> Community Lists
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold font-serif">Discover voteable book lists</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Browse Listopia-style community collections, vote books up or down, and find your next great read.
        </p>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search community lists"
              className="pl-9"
              data-testid="community-list-search"
              aria-label="Search community lists"
            />
          </div>
          <div className="flex gap-2">
            {(['popular', 'newest', 'featured'] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant="outline"
                size="sm"
                className={sort === value ? 'border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background' : ''}
                onClick={() => setSort(value)}
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {featuredLists.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Featured community picks</h2>
          <div className="flex flex-wrap gap-2">
            {featuredLists.map((list) => (
              <Badge key={list.id} variant="outline" className="rounded-full px-3 py-1">
                {list.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No community lists found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different search or create a new community list.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lists.map((list, index) => (
            <motion.div
              key={list.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.03 }}
            >
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-lg" data-testid="community-list-card" >
                <div data-testid={`community-list-card-${list.id}`}>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Community</Badge>
                    {list.isFeatured && <Badge>Featured</Badge>}
                  </div>
                  <CardTitle className="text-xl leading-tight">
                    <Link to={`/lists/${list.id}`} className="hover:text-primary" data-testid={`community-list-link-${list.id}`}>
                      {list.name}
                    </Link>
                  </CardTitle>
                  {list.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{list.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>by {list.userName || 'Community member'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="outline" className="gap-1">
                      <BookOpen className="h-3 w-3" />
                      {list.bookCount} {list.bookCount === 1 ? 'book' : 'books'}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      {list.voteCount} votes
                    </Badge>
                  </div>
                  {list.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {list.categories.slice(0, 3).map((category) => (
                        <Badge key={category} variant="secondary" className="text-[11px]">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ListDiscoveryPage;
