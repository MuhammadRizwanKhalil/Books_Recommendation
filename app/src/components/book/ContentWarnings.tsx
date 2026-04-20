import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, ChevronDown, ThumbsUp, ThumbsDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { contentWarningsApi, type BookContentWarning } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { ContentWarningSubmitModal } from './ContentWarningSubmitModal';

const severityColors: Record<string, string> = {
  mild: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
  moderate: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
  severe: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
};

const severityLabel: Record<string, string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
};

interface ContentWarningsProps {
  bookId: string;
}

export function ContentWarnings({ bookId }: ContentWarningsProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [warnings, setWarnings] = useState<BookContentWarning[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, 'agree' | 'disagree'>>({});
  const [totalWarnings, setTotalWarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const fetchWarnings = useCallback(async () => {
    try {
      const data = await contentWarningsApi.getForBook(bookId);
      setWarnings(data.warnings);
      setUserVotes(data.userVotes);
      setTotalWarnings(data.totalWarnings);
    } catch {
      // Silently fail — section is optional
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    fetchWarnings();
  }, [fetchWarnings]);

  const handleVote = async (submissionId: string, vote: 'agree' | 'disagree') => {
    if (!user) {
      toast.error('Please sign in to vote on content warnings');
      return;
    }
    setVotingId(submissionId);
    try {
      const result = await contentWarningsApi.vote(submissionId, vote);
      // Update local state
      setWarnings(prev => prev.map(w => {
        if (w.submissions.includes(submissionId)) {
          return {
            ...w,
            agreeCount: result.agreeCount,
            disagreeCount: result.disagreeCount,
          };
        }
        return w;
      }));
      // Toggle vote in local state
      setUserVotes(prev => {
        const copy = { ...prev };
        if (copy[submissionId] === vote) {
          delete copy[submissionId];
        } else {
          copy[submissionId] = vote;
        }
        return copy;
      });
    } catch {
      toast.error('Failed to submit vote');
    } finally {
      setVotingId(null);
    }
  };

  if (loading || totalWarnings === 0) return null;

  return (
    <div className="space-y-3">
      {/* Collapsed header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-left w-full group"
        aria-expanded={isExpanded}
        aria-controls="content-warnings-panel"
      >
        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <span className="font-semibold text-sm">
          Content Warnings ({totalWarnings})
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div id="content-warnings-panel" className="space-y-3" role="region" aria-label="Content warnings">
          <div className="flex flex-wrap gap-2">
            {warnings.map(w => (
              <div
                key={w.slug}
                className={`inline-flex flex-col gap-1 rounded-lg border px-3 py-2 text-xs ${severityColors[w.severity] || severityColors.moderate}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{w.name}</span>
                  <span className="opacity-70">· {severityLabel[w.severity]}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="opacity-60 text-[10px]">
                    {w.reportCount} report{w.reportCount !== 1 ? 's' : ''}
                  </span>
                  {w.submissions.map(sid => (
                    <span key={sid} className="inline-flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleVote(sid, 'agree'); }}
                        disabled={votingId === sid}
                        className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
                          userVotes[sid] === 'agree' ? 'font-bold' : ''
                        }`}
                        aria-label={`Agree with ${w.name} warning`}
                        title="Agree"
                      >
                        <ThumbsUp className="h-3 w-3" />
                        <span>{w.agreeCount}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleVote(sid, 'disagree'); }}
                        disabled={votingId === sid}
                        className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
                          userVotes[sid] === 'disagree' ? 'font-bold' : ''
                        }`}
                        aria-label={`Disagree with ${w.name} warning`}
                        title="Disagree"
                      >
                        <ThumbsDown className="h-3 w-3" />
                        <span>{w.disagreeCount}</span>
                      </button>
                    </span>
                  )).slice(0, 1)}
                </div>
              </div>
            ))}
          </div>

          {/* Submit button */}
          {user && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowSubmitModal(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Report a Warning
            </Button>
          )}
          {!user && (
            <p className="text-xs text-muted-foreground">Sign in to report content warnings</p>
          )}

          {showSubmitModal && (
            <ContentWarningSubmitModal
              bookId={bookId}
              onClose={() => setShowSubmitModal(false)}
              onSubmitted={() => {
                setShowSubmitModal(false);
                fetchWarnings();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
