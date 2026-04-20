import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, MessageCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, bookClubsApi, type BookClubDetailResponse, type BookClubPickResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { useSEO } from '@/hooks/useSEO';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function BookClubDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [club, setClub] = useState<BookClubDetailResponse | null>(null);
  const [picks, setPicks] = useState<BookClubPickResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [monthLabel, setMonthLabel] = useState('');
  const [bookId, setBookId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useSEO({
    title: club ? `${club.name} | Book Club | The Book Times` : 'Book Club | The Book Times',
    description: club?.description || 'Read together with a monthly buddy read club.',
  });

  const canSetPick = club?.membershipRole === 'owner' || club?.membershipRole === 'moderator';

  const loadClub = async () => {
    if (!id) return;
    const [detail, history] = await Promise.all([
      bookClubsApi.get(id),
      bookClubsApi.picks(id),
    ]);
    setClub(detail);
    setPicks(history.picks || []);
  };

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);

    Promise.all([bookClubsApi.get(id), bookClubsApi.picks(id)])
      .then(([detail, history]) => {
        if (!active) return;
        setClub(detail);
        setPicks(history.picks || []);
      })
      .catch((err) => {
        if (!active) return;
        toast.error(err instanceof Error ? err.message : 'Failed to load club details');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const handleJoin = async () => {
    if (!id) return;
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }

    setWorking(true);
    try {
      const joined = await bookClubsApi.join(id);
      setClub((prev) => prev ? {
        ...prev,
        isMember: true,
        membershipRole: prev.membershipRole || 'member',
        memberCount: joined.memberCount,
      } : prev);
      await loadClub();
      toast.success('Joined club');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to join club';
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const handleLeave = async () => {
    if (!id) return;

    setWorking(true);
    try {
      const left = await bookClubsApi.leave(id);
      setClub((prev) => prev ? {
        ...prev,
        isMember: false,
        membershipRole: null,
        memberCount: left.memberCount,
      } : prev);
      await loadClub();
      toast.success('Left club');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to leave club';
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const handleSetPick = async () => {
    if (!id) return;
    if (!monthLabel.trim() || !bookId.trim() || !startDate || !endDate) {
      toast.error('All pick fields are required');
      return;
    }

    setWorking(true);
    try {
      await bookClubsApi.setPick(id, {
        monthLabel: monthLabel.trim(),
        bookId: bookId.trim(),
        startDate,
        endDate,
      });
      await loadClub();
      toast.success('Monthly pick updated');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to set pick';
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const pickHistory = useMemo(() => picks.slice(0, 12), [picks]);

  if (loading) {
    return <div className="container mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">Loading club...</div>;
  }

  if (!club) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Book club not found</h1>
        <Button asChild className="mt-4">
          <Link to="/book-clubs">Back to clubs</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8" data-testid="book-club-detail-page">
      <Button variant="ghost" asChild className="mb-4 -ml-2">
        <Link to="/book-clubs">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to clubs
        </Link>
      </Button>

      <section className="mb-6 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold font-serif">{club.name}</h1>
            {club.description && <p className="mt-2 text-muted-foreground">{club.description}</p>}
          </div>
          <Badge variant={club.isPublic ? 'secondary' : 'outline'}>{club.isPublic ? 'Public' : 'Private'}</Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {club.memberCount} members</span>
          {club.membershipRole && <Badge variant="outline">Role: {club.membershipRole}</Badge>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!club.isMember ? (
            <Button data-testid="join-club-button" onClick={handleJoin} disabled={working}>Join club</Button>
          ) : club.membershipRole !== 'owner' ? (
            <Button data-testid="leave-club-button" variant="outline" onClick={handleLeave} disabled={working}>Leave club</Button>
          ) : null}
        </div>
      </section>

      <section className="mb-6" data-testid="current-pick-card">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-4 w-4" /> Current Pick
            </CardTitle>
          </CardHeader>
          <CardContent>
            {club.currentPick ? (
              <div className="space-y-2">
                <p className="font-semibold">
                  <Link to={`/book/${club.currentPick.book.slug}`} className="hover:text-primary">{club.currentPick.book.title}</Link>
                </p>
                <p className="text-sm text-muted-foreground">
                  {club.currentPick.monthLabel} · {club.currentPick.startDate} to {club.currentPick.endDate}
                </p>
                {club.currentPick.discussion?.id ? (
                  <Link
                    to={`/discussions/${club.currentPick.discussion.id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    data-testid="current-pick-discussion-link"
                  >
                    <MessageCircle className="h-4 w-4" /> Open discussion
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground" data-testid="current-pick-discussion-link">Discussion unavailable</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No monthly pick yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      {canSetPick && (
        <section className="mb-6 rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Set monthly pick</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Input data-testid="pick-month-input" value={monthLabel} onChange={(e) => setMonthLabel(e.target.value)} placeholder="Month label (e.g. June 2026)" maxLength={50} />
            <Input data-testid="pick-book-id-input" value={bookId} onChange={(e) => setBookId(e.target.value)} placeholder="Book ID" />
            <Input data-testid="pick-start-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input data-testid="pick-end-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="mt-3 flex justify-end">
            <Button data-testid="set-pick-submit" onClick={handleSetPick} disabled={working}>Set pick</Button>
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Members</h2>
        <div className="rounded-xl border p-4">
          <ul className="space-y-2 text-sm">
            {club.members.map((member) => (
              <li key={member.user.id} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {member.user.name}
                </span>
                <Badge variant="outline">{member.role}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Pick history</h2>
        <div className="rounded-xl border p-4">
          {pickHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No picks yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {pickHistory.map((pick) => (
                <li key={pick.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{pick.monthLabel}: {pick.book.title}</span>
                  </span>
                  {pick.discussionId ? (
                    <Link to={`/discussions/${pick.discussionId}`} className="text-primary hover:underline">Thread</Link>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default BookClubDetail;
