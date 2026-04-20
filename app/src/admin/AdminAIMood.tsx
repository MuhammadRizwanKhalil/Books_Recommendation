import { useState } from 'react';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { aiMoodApi } from '@/api/client';
import { toast } from 'sonner';

export function AdminAIMood() {
  const [limit, setLimit] = useState(10);
  const [bookId, setBookId] = useState('');
  const [runningBatch, setRunningBatch] = useState(false);
  const [runningSingle, setRunningSingle] = useState(false);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const runBatch = async () => {
    try {
      setRunningBatch(true);
      const response = await aiMoodApi.adminBatchAnalyze({ limit, onlyUnanalyzed: true });
      setLastSummary(`Processed ${response.processed} books (${response.successful} successful, ${response.failed} failed)`);
      toast.success(response.message);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to batch analyze books');
    } finally {
      setRunningBatch(false);
    }
  };

  const runSingle = async () => {
    if (!bookId.trim()) {
      toast.error('Enter a book ID or slug first');
      return;
    }

    try {
      setRunningSingle(true);
      const response = await aiMoodApi.adminAnalyzeBook(bookId.trim());
      setLastSummary(`Analyzed ${response.bookId} successfully`);
      toast.success(response.message);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to analyze selected book');
    } finally {
      setRunningSingle(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">AI Mood Detection</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate and refresh AI insights for mood, pace, themes, warnings, and reading difficulty.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Batch Analyze
          </CardTitle>
          <CardDescription>
            Analyze recently added published books that do not have AI mood insights yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="ai-batch-limit">Books to process</Label>
            <Input
              id="ai-batch-limit"
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value || 10))}
            />
          </div>

          <Button onClick={runBatch} disabled={runningBatch} data-testid="admin-ai-batch-analyze">
            {runningBatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
            Run Batch Analysis
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analyze Single Book</CardTitle>
          <CardDescription>
            Trigger AI analysis for a specific book using ID or slug.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="ai-book-id">Book ID or slug</Label>
            <Input
              id="ai-book-id"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000 or dune"
            />
          </div>

          <Button onClick={runSingle} disabled={runningSingle} variant="outline" data-testid="admin-ai-analyze-book">
            {runningSingle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Analyze This Book
          </Button>
        </CardContent>
      </Card>

      {lastSummary && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground" data-testid="admin-ai-summary">{lastSummary}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
