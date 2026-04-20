import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Gift, PlusCircle, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { giveawaysApi, type GiveawayFormat, type GiveawayResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { useSEO } from '@/hooks/useSEO';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function daysRemaining(endDate: string) {
  const remainingMs = new Date(endDate).getTime() - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
}

function toDateTimeLocalInput(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function GiveawaysPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [sort, setSort] = useState<'ending_soon' | 'newest' | 'popular'>('ending_soon');
  const [giveaways, setGiveaways] = useState<GiveawayResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createBookId, setCreateBookId] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createFormat, setCreateFormat] = useState<GiveawayFormat>('ebook');
  const [createCopies, setCreateCopies] = useState('5');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [createCountries, setCreateCountries] = useState('');
  const [autoAddToTbr, setAutoAddToTbr] = useState(true);

  useSEO({
    title: 'Giveaways | The Book Times',
    description: 'Browse active giveaways and enter for a chance to win free book copies.',
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    giveawaysApi.list({ sort })
      .then((res) => {
        if (!active) return;
        setGiveaways(res.giveaways || []);
      })
      .catch((err) => {
        if (!active) return;
        toast.error(err instanceof Error ? err.message : 'Failed to load giveaways');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sort]);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setCreateStartDate(toDateTimeLocalInput(start.toISOString()));
    setCreateEndDate(toDateTimeLocalInput(end.toISOString()));
  }, []);

  const sortedGiveaways = useMemo(() => giveaways, [giveaways]);

  const onCreateGiveaway = async () => {
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }

    const copies = Number.parseInt(createCopies, 10);
    const countries = createCountries
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    if (!createBookId.trim() || !createTitle.trim() || !createStartDate || !createEndDate || !Number.isFinite(copies)) {
      toast.error('Please fill all required giveaway fields');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        bookId: createBookId.trim(),
        title: createTitle.trim(),
        description: createDescription.trim(),
        format: createFormat,
        copiesAvailable: copies,
        startDate: new Date(createStartDate).toISOString(),
        endDate: new Date(createEndDate).toISOString(),
        countryRestriction: countries,
        autoAddToTbr,
      };

      const res = await giveawaysApi.create(payload);
      toast.success('Giveaway created');
      setGiveaways((prev) => [res.giveaway, ...prev]);
      setCreateTitle('');
      setCreateBookId('');
      setCreateDescription('');
      setCreateCountries('');
      setCreateFormat('ebook');
      setCreateCopies('5');
      setAutoAddToTbr(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create giveaway');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8" data-testid="giveaways-page">
      <section className="mb-6 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6">
        <Badge variant="secondary" className="mb-3 gap-1">
          <Gift className="h-3.5 w-3.5" /> Giveaways
        </Badge>
        <h1 className="text-3xl font-bold font-serif">Win Your Next Read</h1>
        <p className="mt-2 text-muted-foreground">Enter active giveaways and discover books before everyone else.</p>

        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Sort giveaways">
          <Button variant={sort === 'ending_soon' ? 'secondary' : 'outline'} onClick={() => setSort('ending_soon')} data-testid="giveaways-sort-ending-soon">
            Ending Soon
          </Button>
          <Button variant={sort === 'newest' ? 'secondary' : 'outline'} onClick={() => setSort('newest')} data-testid="giveaways-sort-newest">
            Newest
          </Button>
          <Button variant={sort === 'popular' ? 'secondary' : 'outline'} onClick={() => setSort('popular')} data-testid="giveaways-sort-popular">
            Popular
          </Button>
          <Link to="/giveaways/my-entries" className="ml-auto">
            <Button variant="outline" data-testid="giveaways-my-entries-link">My Entries</Button>
          </Link>
        </div>
      </section>

      <section className="mb-8 rounded-xl border p-4 md:p-5" data-testid="giveaway-create-panel">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <PlusCircle className="h-4 w-4" /> Create Giveaway
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input placeholder="Giveaway title" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} data-testid="giveaway-create-title" />
          <Input placeholder="Book ID" value={createBookId} onChange={(e) => setCreateBookId(e.target.value)} data-testid="giveaway-create-book-id" />
          <Input placeholder="Format: ebook|paperback|hardcover|audiobook" value={createFormat} onChange={(e) => setCreateFormat(e.target.value as GiveawayFormat)} data-testid="giveaway-create-format" />
          <Input placeholder="Copies available" value={createCopies} onChange={(e) => setCreateCopies(e.target.value)} data-testid="giveaway-create-copies" />
          <Input
            type="datetime-local"
            aria-label="Giveaway start date and time"
            value={createStartDate}
            onChange={(e) => setCreateStartDate(e.target.value)}
            data-testid="giveaway-create-start"
          />
          <Input
            type="datetime-local"
            aria-label="Giveaway end date and time"
            value={createEndDate}
            onChange={(e) => setCreateEndDate(e.target.value)}
            data-testid="giveaway-create-end"
          />
        </div>
        <Textarea
          className="mt-3"
          placeholder="Description"
          value={createDescription}
          onChange={(e) => setCreateDescription(e.target.value)}
          data-testid="giveaway-create-description"
        />
        <Input
          className="mt-3"
          placeholder="Country restriction ISO codes, comma-separated (optional)"
          value={createCountries}
          onChange={(e) => setCreateCountries(e.target.value)}
          data-testid="giveaway-create-countries"
        />
        <label className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={autoAddToTbr} onChange={(e) => setAutoAddToTbr(e.target.checked)} data-testid="giveaway-create-auto-add" />
          Auto add entrants to want-to-read
        </label>
        <div className="mt-3 flex justify-end">
          <Button variant="outline" onClick={onCreateGiveaway} disabled={creating} data-testid="giveaway-create-submit">
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">Loading giveaways...</div>
      ) : sortedGiveaways.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Ticket className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="font-medium">No active giveaways yet</p>
          <p className="text-sm text-muted-foreground">Check back soon for new opportunities.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedGiveaways.map((giveaway) => (
            <Card key={giveaway.id} data-testid={`giveaway-card-${giveaway.id}`}>
              <CardHeader>
                <CardTitle className="line-clamp-2 text-xl">
                  <Link to={`/giveaways/${giveaway.id}`} className="hover:text-primary">{giveaway.title}</Link>
                </CardTitle>
                <p className="text-sm text-muted-foreground line-clamp-1">{giveaway.book?.title || 'Book unavailable'}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4" />
                  <span data-testid="giveaway-copies">{giveaway.copiesAvailable} copies</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  <span data-testid="giveaway-days-remaining">
                    {daysRemaining(giveaway.endDate) > 0 ? `${daysRemaining(giveaway.endDate)} days remaining` : 'Giveaway ended'}
                  </span>
                </div>
                <div className="pt-2">
                  <Link to={`/giveaways/${giveaway.id}`}>
                    <Button variant="outline" className="w-full" data-testid={`giveaway-open-${giveaway.id}`}>View Giveaway</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default GiveawaysPage;
