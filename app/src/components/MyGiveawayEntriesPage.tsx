import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Trophy } from 'lucide-react';
import { giveawaysApi, type GiveawayEntryResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { useSEO } from '@/hooks/useSEO';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function MyGiveawayEntriesPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [entries, setEntries] = useState<GiveawayEntryResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useSEO({
    title: 'My Giveaway Entries | The Book Times',
    description: 'Track your giveaway entries and see winner announcements.',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let active = true;
    giveawaysApi.myEntries()
      .then((res) => {
        if (!active) return;
        setEntries(res.entries || []);
      })
      .catch((err) => {
        if (!active) return;
        toast.error(err instanceof Error ? err.message : 'Failed to load entries');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const grouped = useMemo(() => {
    const winners = entries.filter((entry) => entry.isWinner);
    const others = entries.filter((entry) => !entry.isWinner);
    return { winners, others };
  }, [entries]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8" data-testid="giveaway-my-entries-unauthenticated">
        <p className="mb-3 text-sm text-muted-foreground">Sign in to view your giveaway entries.</p>
        <button className="text-sm font-medium text-primary hover:underline" onClick={() => openAuthModal('signin')}>
          Sign in
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8" data-testid="giveaway-my-entries-loading">
        <p className="text-sm text-muted-foreground">Loading your entries...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8" data-testid="giveaway-my-entries-page">
      <h1 className="mb-6 text-3xl font-bold font-serif">My Giveaway Entries</h1>

      {grouped.winners.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Winners</h2>
          <div className="space-y-3">
            {grouped.winners.map((entry) => (
              <Card key={entry.id} data-testid={`giveaway-entry-${entry.id}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Trophy className="h-4 w-4 text-green-600" />
                    <Link to={`/giveaways/${entry.giveaway.id}`} className="hover:text-primary">
                      {entry.giveaway.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary" data-testid="giveaway-entry-result">Winner</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">All Entries</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="giveaway-my-entries-empty">You have not entered any giveaways yet.</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <Card key={entry.id} data-testid={`giveaway-entry-${entry.id}`}>
                <CardHeader>
                  <CardTitle className="text-xl">
                    <Link to={`/giveaways/${entry.giveaway.id}`} className="hover:text-primary">
                      {entry.giveaway.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{entry.giveaway.book?.title}</p>
                  <p>Entered: {new Date(entry.enteredAt).toLocaleDateString()}</p>
                  <Badge variant={entry.isWinner ? 'secondary' : 'outline'} data-testid="giveaway-entry-result">
                    {entry.isWinner ? 'Winner' : 'Pending'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default MyGiveawayEntriesPage;
