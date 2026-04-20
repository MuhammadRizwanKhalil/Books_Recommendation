import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BookOpen, PlusCircle, Search, Users } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { useAuth } from '@/components/AuthProvider';
import { ApiError, bookClubsApi, type BookClubResponse } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function BookClubsPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [clubs, setClubs] = useState<BookClubResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'popular' | 'newest'>('popular');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  useSEO({
    title: 'Book Clubs & Buddy Reads | The Book Times',
    description: 'Discover and join community book clubs, follow monthly picks, and read together.',
  });

  useEffect(() => {
    let active = true;
    setLoading(true);

    const timer = setTimeout(() => {
      bookClubsApi.discover({ page: 1, limit: 30, search, sort })
        .then((res) => {
          if (!active) return;
          setClubs(res.clubs || []);
        })
        .catch((err) => {
          if (!active) return;
          toast.error(err instanceof Error ? err.message : 'Failed to load clubs');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, sort]);

  const handleCreate = async () => {
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) {
      toast.error('Club name is required');
      return;
    }

    setCreating(true);
    try {
      const created = await bookClubsApi.create({
        name: trimmedName,
        description: trimmedDescription,
        isPublic,
      });
      setClubs((prev) => [created, ...prev]);
      setName('');
      setDescription('');
      setIsPublic(true);
      toast.success('Book club created');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create club';
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8" data-testid="book-clubs-page">
      <section className="mb-8 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6">
        <Badge variant="secondary" className="mb-3 gap-1">
          <BookOpen className="h-3.5 w-3.5" /> Book Clubs
        </Badge>
        <h1 className="text-3xl font-bold font-serif">Book Clubs & Buddy Reads</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Discover public clubs, join monthly buddy reads, and discuss each pick together.
        </p>

        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clubs"
              className="pl-9"
              aria-label="Search clubs"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className={sort === 'popular' ? 'border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background' : ''}
              onClick={() => setSort('popular')}
            >
              Popular
            </Button>
            <Button
              type="button"
              variant="outline"
              className={sort === 'newest' ? 'border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background' : ''}
              onClick={() => setSort('newest')}
            >
              Newest
            </Button>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-xl border p-4 md:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <PlusCircle className="h-4 w-4" /> Create a club
        </h2>
        <div className="grid gap-3 md:grid-cols-[1fr,2fr]">
          <Input
            data-testid="club-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Club name"
            maxLength={255}
          />
          <Input
            data-testid="club-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            maxLength={500}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Public club
          </label>
          <Button
            data-testid="create-club-submit"
            onClick={handleCreate}
            disabled={creating}
            className="bg-foreground text-background hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
          >
            {creating ? 'Creating...' : 'Create club'}
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">Loading clubs...</div>
      ) : clubs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Users className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="font-medium">No clubs found</p>
          <p className="text-sm text-muted-foreground">Try another search or create a new club.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clubs.map((club) => (
            <Card key={club.id} className="h-full" data-testid={`book-club-card-${club.id}`}>
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl leading-tight">
                  <Link to={`/book-clubs/${club.id}`} className="hover:text-primary">
                    {club.name}
                  </Link>
                </CardTitle>
                {club.description && <p className="line-clamp-2 text-sm text-muted-foreground">{club.description}</p>}
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{club.memberCount} {club.memberCount === 1 ? 'member' : 'members'}</span>
                </div>
                <div>
                  {club.isPublic ? (
                    <Badge variant="secondary">Public</Badge>
                  ) : (
                    <Badge variant="outline">Private</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default BookClubsPage;
