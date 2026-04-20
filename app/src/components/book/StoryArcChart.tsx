import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ChevronDown, Sparkles, TrendingUp } from 'lucide-react';
import { storyArcApi, type StoryArcResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface StoryArcChartProps {
  bookId: string;
}

const SOURCE_LABELS: Record<string, string> = {
  ai: 'AI Generated',
  community_avg: 'Community Average',
  admin: 'Editorial',
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatIntensity(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function StoryArcChart({ bookId }: StoryArcChartProps) {
  const { user } = useAuth();
  const [data, setData] = useState<StoryArcResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [voting, setVoting] = useState(false);
  const [positionPercent, setPositionPercent] = useState(50);
  const [intensityPercent, setIntensityPercent] = useState(60);
  const [label, setLabel] = useState('');

  const fetchArc = useCallback(async () => {
    try {
      const response = await storyArcApi.getForBook(bookId);
      setData(response);
    } catch {
      setData({ arc: [], source: 'ai', voterCount: 0 });
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    fetchArc();
  }, [fetchArc]);

  const sortedArc = useMemo(
    () => [...(data?.arc || [])].sort((a, b) => a.position - b.position),
    [data?.arc],
  );

  const keyPoints = useMemo(
    () => sortedArc.filter((point) => !!point.label),
    [sortedArc],
  );

  const ariaLabel = useMemo(() => {
    if (sortedArc.length === 0) {
      return 'Story arc chart unavailable';
    }
    return `Story arc chart with ${sortedArc.length} points and source ${SOURCE_LABELS[data?.source || 'ai'] || 'Unknown'}`;
  }, [data?.source, sortedArc]);

  const handleVoteSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || voting) return;

    setVoting(true);
    try {
      const response = await storyArcApi.vote(bookId, {
        positionPercent,
        intensity: intensityPercent / 100,
        label: label.trim() || undefined,
      });
      setData({ arc: response.arc, source: response.source, voterCount: response.voterCount });
      setLabel('');
      toast.success('Your story arc point was added');
    } catch {
      toast.error('Failed to submit story arc vote');
    } finally {
      setVoting(false);
    }
  };

  if (loading) return null;
  if (!data || sortedArc.length === 0) return null;

  return (
    <section className="space-y-3" data-testid="story-arc-section" aria-label="Story arc visualization section">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded((prev) => !prev)}
        aria-controls="story-arc-panel"
        data-expanded={expanded ? 'true' : 'false'}
        data-testid="story-arc-toggle"
      >
        <TrendingUp className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Story Arc</span>
        <span className="text-xs text-muted-foreground">({SOURCE_LABELS[data.source] || data.source})</span>
        <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div id="story-arc-panel" className="space-y-4">
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
            data-testid="story-arc-spoiler-warning"
            role="note"
            aria-label="Spoiler warning"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Potential spoilers ahead: this chart summarizes narrative tension from start to finish.</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-3" data-testid="story-arc-chart" role="img" aria-label={ariaLabel}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={sortedArc} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="storyArcFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                <XAxis
                  dataKey="position"
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={formatPercent}
                  label={{ value: 'Book progression', position: 'insideBottom', offset: -4 }}
                />
                <YAxis
                  dataKey="intensity"
                  domain={[0, 1]}
                  tickFormatter={formatIntensity}
                  label={{ value: 'Emotional intensity', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value: any) => [formatIntensity(Number(value)), 'Intensity']}
                  labelFormatter={(value: any) => `Position: ${formatPercent(Number(value))}`}
                  contentStyle={{ borderRadius: 10, borderColor: 'hsl(var(--border))' }}
                />
                <Area
                  type="monotone"
                  dataKey="intensity"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill="url(#storyArcFill)"
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {keyPoints.length > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <h4 className="mb-2 text-sm font-medium">Key points</h4>
              <ul className="grid gap-2 sm:grid-cols-2" role="list">
                {keyPoints.map((point, index) => (
                  <li
                    key={`${point.position}-${index}`}
                    className="rounded-md bg-background px-2 py-1.5 text-sm"
                    data-testid="story-arc-key-point"
                    title={`${point.label || 'Point'} at ${formatPercent(point.position)}`}
                  >
                    <span className="font-medium">{point.label}</span>
                    <span className="ml-2 text-muted-foreground">{formatPercent(point.position)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{data.voterCount} community voter{data.voterCount === 1 ? '' : 's'}</span>
          </div>

          {user && (
            <form onSubmit={handleVoteSubmit} className="rounded-lg border bg-muted/30 p-3" data-testid="story-arc-vote-form">
              <p className="mb-3 text-sm font-medium">Add your own story arc point</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Book position ({formatPercent(positionPercent)})</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={positionPercent}
                    onChange={(event) => setPositionPercent(Number(event.target.value))}
                    className="w-full"
                    aria-label="Story arc position"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Intensity ({intensityPercent}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={intensityPercent}
                    onChange={(event) => setIntensityPercent(Number(event.target.value))}
                    className="w-full"
                    aria-label="Story arc intensity"
                  />
                </label>
              </div>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block text-muted-foreground">Optional label</span>
                <input
                  type="text"
                  maxLength={100}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="e.g. Midpoint reveal"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  aria-label="Story arc label"
                />
              </label>
              <div className="mt-3 flex justify-end">
                <Button type="submit" size="sm" disabled={voting} data-testid="story-arc-vote-submit">
                  {voting ? 'Submitting...' : 'Submit point'}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
