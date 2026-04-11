import { useEffect, useState, useCallback } from 'react';
import {
  Download, Play, Loader2, CheckCircle2, XCircle,
  Clock, BookOpen, RefreshCw, AlertTriangle, ImageIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { importApi } from '@/api/client';
import { toast } from 'sonner';

interface ImportJob {
  id: string;
  type: string;
  status: string;
  totalFetched: number;
  newInserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  startedAt: string;
  completedAt: string | null;
}

export function AdminImport() {
  const [isRunning, setIsRunning] = useState(false);
  const [isCoverUpgradeRunning, setIsCoverUpgradeRunning] = useState(false);
  const [coverLimit, setCoverLimit] = useState(500);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statusRes, historyRes, coverStatusRes] = await Promise.all([
        importApi.getStatus(),
        importApi.getHistory(20),
        importApi.getCoverUpgradeStatus(),
      ]);
      setIsRunning(statusRes.running);
      setJobs(historyRes.jobs);
      setIsCoverUpgradeRunning(coverStatusRes.running);

      // If a job is running, start polling
      if ((statusRes.running || coverStatusRes.running) && !polling) {
        setPolling(true);
      } else if (!statusRes.running && !coverStatusRes.running && polling) {
        setPolling(false);
      }
    } catch (err) {
      console.error('Failed to load import data:', err);
    } finally {
      setLoading(false);
    }
  }, [polling]);

  useEffect(() => {
    loadData();
  }, []);

  // Poll every 5 seconds while a job is running
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [polling, loadData]);

  const handleUpgradeCovers = async () => {
    try {
      const res = await importApi.upgradCovers(coverLimit, false);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Cover upgrade started! Processing ${res.booksToProcess} books...`);
      setIsCoverUpgradeRunning(true);
      setPolling(true);
      loadData();
    } catch (err) {
      console.error('Failed to start cover upgrade:', err);
      toast.error('Failed to start cover upgrade');
    }
  };

  const handleRunImport = async (type: 'initial' | 'daily') => {
    try {
      const res = await importApi.run(type);
      toast.success(res.message);
      setIsRunning(true);
      setPolling(true);
      // Refresh after a short delay
      setTimeout(loadData, 2000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start import');
    }
  };

  const latestJob = jobs[0];
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const totalImported = completedJobs.reduce((sum, j) => sum + j.newInserted, 0);
  const totalUpdated = completedJobs.reduce((sum, j) => sum + j.updated, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Book Import</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Book Import</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Import books from Google Books API automatically
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status + Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isRunning ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-lg font-semibold text-primary">Import Running...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-lg font-semibold">Idle</span>
              </div>
            )}
            {latestJob && (
              <p className="text-xs text-muted-foreground mt-2">
                Last run: {new Date(latestJob.startedAt).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Total Imported */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Imported</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{totalImported}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalUpdated} updated across {completedJobs.length} runs
            </p>
          </CardContent>
        </Card>

        {/* Cron Schedule */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold">Daily at 3:00 AM</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Configure via IMPORT_CRON_SCHEDULE in .env
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Import Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Manual Import
          </CardTitle>
          <CardDescription>
            Trigger a book import from Google Books API manually.
            The cron job also runs this automatically on schedule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 p-4 border rounded-lg">
              <h3 className="font-semibold mb-1">Daily Import</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Fetch new &amp; trending books published recently. Quick incremental update.
              </p>
              <Button
                onClick={() => handleRunImport('daily')}
                disabled={isRunning}
                className="w-full sm:w-auto"
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Run Daily Import
              </Button>
            </div>

            <div className="flex-1 p-4 border rounded-lg">
              <h3 className="font-semibold mb-1">Full Import</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Fetch top/popular books across all categories. Use for initial DB population.
              </p>
              <Button
                variant="outline"
                onClick={() => handleRunImport('initial')}
                disabled={isRunning}
                className="w-full sm:w-auto"
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Run Full Import
              </Button>
            </div>
          </div>

          {!isRunning && latestJob?.status === 'completed' && latestJob.totalFetched === 0 && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Last import fetched 0 books
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                  This usually means Google Books API rate limit was hit. Add a
                  <code className="mx-1 px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900 rounded text-xs">GOOGLE_BOOKS_API_KEY</code>
                  to your .env file for higher limits (free from Google Cloud Console).
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cover Upgrade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Upgrade Book Covers
          </CardTitle>
          <CardDescription>
            Upgrade existing book covers to higher resolution images using Open Library and Google Books HD sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will find books with low-resolution cover images (zoom=1 thumbnails) and attempt to upgrade them to HD versions from Open Library or Google Books (zoom=0).
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="w-full sm:w-40">
                <label className="text-sm font-medium mb-1.5 block">Books to process</label>
                <Input
                  type="number"
                  min={1}
                  max={5000}
                  value={coverLimit}
                  onChange={(e) => setCoverLimit(Math.min(5000, Math.max(1, parseInt(e.target.value) || 500)))}
                  disabled={isCoverUpgradeRunning}
                />
              </div>
              <Button
                onClick={handleUpgradeCovers}
                disabled={isCoverUpgradeRunning || isRunning}
                className="w-full sm:w-auto"
              >
                {isCoverUpgradeRunning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4 mr-2" />
                )}
                {isCoverUpgradeRunning ? 'Upgrading Covers...' : 'Upgrade Covers'}
              </Button>
            </div>
            {isCoverUpgradeRunning && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Cover upgrade in progress. This may take several minutes depending on the number of books. Check server logs for detailed progress.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <CardDescription>
            Recent import job runs and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No import jobs have been run yet. Trigger one above or wait for the daily cron.
            </p>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-2"
                >
                  <div className="flex items-center gap-3">
                    {job.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
                    {job.status === 'running' && <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />}
                    {job.status === 'failed' && <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {job.type === 'initial' ? 'Full Import' : 'Daily Import'}
                        </span>
                        <Badge
                          variant={
                            job.status === 'completed' ? 'default' :
                            job.status === 'running' ? 'secondary' : 'destructive'
                          }
                          className="text-xs"
                        >
                          {job.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.startedAt).toLocaleString()}
                        {job.completedAt && (
                          <> · Duration: {formatDuration(job.startedAt, job.completedAt)}</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-semibold">{job.totalFetched}</p>
                      <p className="text-xs text-muted-foreground">Fetched</p>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="text-center">
                      <p className="font-semibold text-green-600">{job.newInserted}</p>
                      <p className="text-xs text-muted-foreground">New</p>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="text-center">
                      <p className="font-semibold text-blue-600">{job.updated}</p>
                      <p className="text-xs text-muted-foreground">Updated</p>
                    </div>
                    {job.errors.length > 0 && (
                      <>
                        <Separator orientation="vertical" className="h-8" />
                        <div className="text-center">
                          <p className="font-semibold text-red-600">{job.errors.length}</p>
                          <p className="text-xs text-muted-foreground">Errors</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
