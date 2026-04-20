import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Gift, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { giveawaysApi, type GiveawayDetailResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { useSEO } from '@/hooks/useSEO';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatCountDown(endDate: string) {
  const remainingMs = new Date(endDate).getTime() - Date.now();
  if (remainingMs <= 0) return 'Giveaway ended';
  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `${days}d ${hours}h remaining`;
}

export function GiveawayDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectingWinners, setSelectingWinners] = useState(false);
  const [detail, setDetail] = useState<GiveawayDetailResponse | null>(null);

  const countdown = useMemo(
    () => (detail?.giveaway ? formatCountDown(detail.giveaway.endDate) : ''),
    [detail?.giveaway],
  );

  useSEO({
    title: detail?.giveaway ? `${detail.giveaway.title} | Giveaway | The Book Times` : 'Giveaway | The Book Times',
    description: detail?.giveaway?.description || 'Enter this giveaway for a chance to win a copy.',
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    giveawaysApi.get(id)
      .then((res) => setDetail(res))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load giveaway'))
      .finally(() => setLoading(false));
  }, [id]);

  const onEnter = async () => {
    if (!id) return;
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }

    setSubmitting(true);
    try {
      await giveawaysApi.enter(id);
      toast.success('Entry submitted');
      const updated = await giveawaysApi.get(id);
      setDetail(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to enter giveaway');
    } finally {
      setSubmitting(false);
    }
  };

  const onSelectWinners = async () => {
    if (!id) return;
    setSelectingWinners(true);
    try {
      const res = await giveawaysApi.selectWinners(id);
      toast.success(`Selected ${res.winnerCount} winners`);
      const updated = await giveawaysApi.get(id);
      setDetail(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to select winners');
    } finally {
      setSelectingWinners(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8" data-testid="giveaway-detail-loading">
        <p className="text-sm text-muted-foreground">Loading giveaway...</p>
      </div>
    );
  }

  if (!detail?.giveaway) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8" data-testid="giveaway-detail-not-found">
        <p className="text-sm text-destructive">Giveaway not found.</p>
      </div>
    );
  }

  const giveaway = detail.giveaway;
  const isEnded = giveaway.status === 'ended' || giveaway.status === 'winners_selected' || new Date(giveaway.endDate).getTime() <= Date.now();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8" data-testid="giveaway-detail-page">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Gift className="h-3.5 w-3.5" /> Giveaway
            </Badge>
            <Badge variant="outline" data-testid="giveaway-status">{giveaway.status}</Badge>
          </div>
          <CardTitle className="text-3xl font-serif">{giveaway.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{giveaway.book?.title} by {giveaway.book?.author}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {giveaway.description && <p className="text-sm text-muted-foreground">{giveaway.description}</p>}

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div data-testid="giveaway-entry-count">Entries: {giveaway.entryCount}</div>
            <div data-testid="giveaway-copies-available">Copies: {giveaway.copiesAvailable}</div>
            <div data-testid="giveaway-countdown">{countdown}</div>
            <div>Format: {giveaway.format}</div>
          </div>

          {detail.entry && (
            <div className="rounded-md bg-muted p-3 text-sm" data-testid="giveaway-already-entered">
              You already entered on {new Date(detail.entry.enteredAt).toLocaleDateString()}.
            </div>
          )}

          {!isAuthenticated && (
            <div className="rounded-md border p-3 text-sm" data-testid="giveaway-signin-prompt">
              Sign in to enter this giveaway.
            </div>
          )}

          {isEnded ? (
            <div className="rounded-md border p-3 text-sm" data-testid="giveaway-ended">
              Giveaway ended.
            </div>
          ) : (
            <Button
              onClick={onEnter}
              disabled={submitting || !!detail.entry}
              className="w-full sm:w-auto"
              data-testid="giveaway-enter-button"
            >
              {detail.entry ? 'Already Entered' : submitting ? 'Entering...' : 'Enter Giveaway'}
            </Button>
          )}

          {detail.entry?.isWinner && (
            <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm" data-testid="giveaway-winner-banner">
              <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400">
                <Trophy className="h-4 w-4" /> Winner Announcement
              </div>
              <p className="mt-1">Congratulations! You won this giveaway.</p>
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="outline"
              onClick={onSelectWinners}
              disabled={selectingWinners}
              data-testid="giveaway-select-winners"
            >
              {selectingWinners ? 'Selecting...' : 'Select Winners'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default GiveawayDetailPage;
