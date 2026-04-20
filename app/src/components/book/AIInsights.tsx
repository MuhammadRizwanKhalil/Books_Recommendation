import { useEffect, useMemo, useState } from 'react';
import { Bot, Gauge, Sparkles, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { aiMoodApi, type AIBookAnalysisResponse } from '@/api/client';

interface AIInsightsProps {
  bookId: string;
}

function confidenceLabel(value: number) {
  if (value >= 0.8) return 'High confidence';
  if (value >= 0.6) return 'Medium confidence';
  return 'Low confidence';
}

function formatMoodLabel(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AIInsights({ bookId }: AIInsightsProps) {
  const [data, setData] = useState<AIBookAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const result = await aiMoodApi.getBookAnalysis(bookId);
        if (!active) return;
        setData(result);
        setError(null);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Failed to load AI insights');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [bookId]);

  const hasInsights = useMemo(() => {
    if (!data) return false;
    return Boolean(
      data.mood?.moods?.length ||
      data.pace?.pace ||
      data.themes?.themes?.length ||
      data.contentWarnings?.warnings?.length ||
      data.difficulty?.level,
    );
  }, [data]);

  if (loading) {
    return (
      <section className="rounded-xl border bg-muted/20 p-4" data-testid="ai-insights-section">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bot className="h-4 w-4 animate-pulse" />
          Loading AI insights...
        </div>
      </section>
    );
  }

  if (error || !hasInsights || !data) {
    return null;
  }

  const moods = data.mood?.moods || [];
  const themes = data.themes?.themes || [];
  const warnings = data.contentWarnings?.warnings || [];

  return (
    <section className="rounded-xl border bg-muted/20 p-4 sm:p-5 space-y-4" data-testid="ai-insights-section">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-base sm:text-lg font-semibold">AI Insights</h2>
        </div>
        <Badge variant="secondary" className="text-xs" data-testid="ai-detected-label">
          AI-detected
        </Badge>
      </div>

      {moods.length > 0 && (
        <div className="space-y-2" data-testid="ai-insights-moods">
          <p className="text-sm font-medium">Mood</p>
          <div className="flex flex-wrap gap-2">
            {moods.map((mood) => (
              <Badge key={mood} variant="outline" className="capitalize" data-testid={`ai-mood-tag-${mood}`}>
                {formatMoodLabel(mood)}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground" data-testid="ai-mood-confidence">
            {confidenceLabel(data.mood?.confidence || 0)} ({Math.round((data.mood?.confidence || 0) * 100)}%)
          </p>
        </div>
      )}

      {data.pace?.pace && (
        <div className="space-y-2" data-testid="ai-insights-pace">
          <p className="text-sm font-medium">Pace</p>
          <div className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="capitalize">{data.pace.pace}</span>
          </div>
        </div>
      )}

      {themes.length > 0 && (
        <div className="space-y-2" data-testid="ai-insights-themes">
          <p className="text-sm font-medium">Themes</p>
          <div className="flex flex-wrap gap-2">
            {themes.map((theme) => (
              <Badge key={theme} variant="secondary">{theme}</Badge>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-2" data-testid="ai-insights-content-warnings">
          <p className="text-sm font-medium">Content Warnings</p>
          <div className="flex flex-wrap gap-2">
            {warnings.map((warning) => (
              <Badge key={warning} variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/60 dark:text-red-100">
                <ShieldAlert className="mr-1 h-3 w-3" />
                {warning}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Model: {data.modelVersion || 'gpt-4o-mini'}
        </span>
        {data.analyzedAt && (
          <span>
            Updated: {new Date(data.analyzedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <div>
        <Button variant="ghost" size="sm" className="px-0 text-xs text-muted-foreground hover:text-foreground" disabled>
          AI insights are informational and may not reflect every reader's experience.
        </Button>
      </div>
    </section>
  );
}
