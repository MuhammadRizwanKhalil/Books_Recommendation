import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Award, Medal, Vote, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { choiceAwardsApi, type ChoiceAwardsPayload } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSEO } from '@/hooks/useSEO';

function VoteProgress({ value, max, testId }: { value: number; max: number; testId: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1" aria-label={`Vote progress ${pct}%`}>
      <progress
        className="h-2.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
        value={value}
        max={Math.max(1, max)}
        aria-label={`${value} votes out of ${Math.max(1, max)}`}
      />
      <p className="text-xs text-muted-foreground" data-testid={testId}>{value} votes</p>
    </div>
  );
}

export function ChoiceAwardsPage() {
  const { year } = useParams<{ year: string }>();
  const parsedYear = Number.parseInt(String(year || new Date().getFullYear()), 10);
  const selectedYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();

  const { isAuthenticated, openAuthModal } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ChoiceAwardsPayload | null>(null);

  useSEO({
    title: `TheBookTimes Choice Awards ${selectedYear}`,
    description: `Vote in TheBookTimes community awards ${selectedYear} and discover this year's finalists and winners.`,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await choiceAwardsApi.getByYear(selectedYear);
      setPayload(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load awards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [selectedYear]);

  const maxVotesPerCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const category of payload?.categories || []) {
      map[category.id] = Math.max(1, ...category.nominees.map((n) => n.voteCount));
    }
    return map;
  }, [payload]);

  async function handleVote(categoryId: string, nomineeId: string) {
    if (!payload) return;

    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }

    try {
      await choiceAwardsApi.vote(selectedYear, categoryId, nomineeId);
      toast.success('Vote submitted');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Vote failed');
    }
  }

  if (loading) {
    return (
      <div>
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div>
        <div className="container mx-auto px-4 py-16 text-center" data-testid="choice-awards-error">
          <h1 className="text-2xl font-semibold">Choice Awards unavailable</h1>
          <p className="text-muted-foreground mt-2">{error || 'Awards not found for this year.'}</p>
        </div>
      </div>
    );
  }

  const { award, categories } = payload;

  return (
    <div>
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6" data-testid="choice-awards-page">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border bg-card p-6"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Award className="h-8 w-8 text-primary" />
                TheBookTimes Choice Awards {award.year}
              </h1>
              <p className="text-muted-foreground mt-2">
                {award.resultsPublished
                  ? 'Results are live. Winners are marked below.'
                  : award.isVotingOpen
                    ? 'Voting is open. You get one vote per category.'
                    : 'Voting is currently closed.'}
              </p>
            </div>

            {!isAuthenticated && (
              <Button variant="outline" onClick={() => openAuthModal('signin')} data-testid="choice-awards-signin">
                Sign in to vote
              </Button>
            )}
          </div>
        </motion.section>

        <div className="grid gap-5 md:grid-cols-2" data-testid="choice-awards-categories">
          {categories.map((category, categoryIndex) => (
            <motion.section
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.25, delay: categoryIndex * 0.03 }}
            >
              <Card data-testid={`choice-awards-category-${category.id}`}>
                <CardHeader>
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {category.nominees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No nominees yet.</p>
                  ) : (
                    category.nominees.map((nominee) => {
                      const alreadyVoted = !!category.myVoteNomineeId;
                      const isMyVote = nominee.id === category.myVoteNomineeId;
                      const votingLocked = !award.isVotingOpen || award.resultsPublished;

                      return (
                        <div
                          key={nominee.id}
                          className="rounded-xl border p-3 space-y-2"
                          data-testid={`choice-awards-nominee-${nominee.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={nominee.book.coverImage || 'https://placehold.co/80x120?text=Book'}
                              alt={nominee.book.title}
                              className="h-16 w-12 rounded object-cover border"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium leading-tight">{nominee.book.title}</p>
                              <p className="text-sm text-muted-foreground">{nominee.book.author}</p>
                              {nominee.isWinner && (
                                <p className="text-xs mt-1 inline-flex items-center gap-1 text-amber-800" data-testid={`choice-awards-winner-${nominee.id}`}>
                                  <Medal className="h-3 w-3" /> Winner
                                </p>
                              )}
                            </div>
                          </div>

                          <VoteProgress
                            value={nominee.voteCount}
                            max={maxVotesPerCategory[category.id]}
                            testId={`choice-awards-vote-count-${category.id}-${nominee.id}`}
                          />

                          <Button
                            size="sm"
                            className="w-full"
                            variant={isMyVote ? 'secondary' : 'default'}
                            disabled={votingLocked || alreadyVoted}
                            onClick={() => void handleVote(category.id, nominee.id)}
                            data-testid={`choice-awards-vote-${category.id}-${nominee.id}`}
                            aria-label={`Vote for ${nominee.book.title} in ${category.name}`}
                          >
                            {votingLocked ? (
                              <><Lock className="h-3.5 w-3.5 mr-1" /> Voting closed</>
                            ) : alreadyVoted ? (
                              isMyVote ? 'Voted' : 'Vote used in this category'
                            ) : (
                              <><Vote className="h-3.5 w-3.5 mr-1" /> Vote</>
                            )}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </motion.section>
          ))}
        </div>
      </div>
    </div>
  );
}
