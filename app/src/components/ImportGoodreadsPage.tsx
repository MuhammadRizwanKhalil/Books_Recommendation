import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Clock,
  ArrowRight, RefreshCw, BookOpen, BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/AuthProvider';
import {
  goodreadsImportApi,
  type ImportJobResponse,
  type ImportJobDetail,
  type ImportHistoryJob,
} from '@/api/client';
import { useSEO } from '@/hooks/useSEO';

type Phase = 'upload' | 'preview' | 'processing' | 'results';

export function ImportGoodreadsPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportJobResponse | null>(null);
  const [job, setJob] = useState<ImportJobDetail | null>(null);
  const [history, setHistory] = useState<ImportHistoryJob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useSEO({
    title: 'Import from Goodreads - The Book Times',
    description: 'Import your reading history, ratings, and shelves from Goodreads CSV export.',
    ogTitle: 'Import from Goodreads - The Book Times',
  });

  // Load history on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    goodreadsImportApi.getHistory()
      .then(res => setHistory(res.jobs))
      .catch(() => {});
  }, [isAuthenticated]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollJob = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const detail = await goodreadsImportApi.getJob(jobId);
        setJob(detail);
        if (detail.status === 'completed' || detail.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPhase('results');
          if (detail.status === 'completed') {
            toast.success(`Import complete! ${detail.matchedBooks} books imported.`);
          } else {
            toast.error('Import failed. Please try again.');
          }
        }
      } catch {
        // Silently continue polling
      }
    }, 1500);
  }, []);

  const handleFileSelect = (f: File) => {
    if (!f.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const result = await goodreadsImportApi.upload(file);
      setPreview(result);
      setPhase('preview');
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleStartImport = () => {
    if (!preview) return;
    setPhase('processing');
    pollJob(preview.jobId);
  };

  const handleReset = () => {
    setPhase('upload');
    setFile(null);
    setPreview(null);
    setJob(null);
    setError(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    // Refresh history
    goodreadsImportApi.getHistory()
      .then(res => setHistory(res.jobs))
      .catch(() => {});
  };

  // Unauthenticated gate
  if (!isAuthenticated) {
    return (
      <div>
        <div className="container mx-auto px-4 py-16 text-center space-y-4" data-testid="import-auth-required">
          <Upload className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-3xl font-bold">Import from Goodreads</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Sign in to import your reading history from Goodreads.
          </p>
          <Button onClick={() => openAuthModal('signin')} data-testid="import-signin-btn">
            Sign In to Import
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8" data-testid="import-goodreads-page">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Upload className="h-8 w-8 text-primary" />
            Import from Goodreads
          </h1>
          <p className="text-muted-foreground mt-1">Import your reading history, ratings, and shelves</p>
        </div>

        {/* Instructions */}
        <Card data-testid="import-instructions">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How to export from Goodreads</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div className="flex items-start gap-2">
              <span className="font-bold text-primary min-w-[20px]">1.</span>
              <span>Go to <strong>Goodreads → My Books</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-primary min-w-[20px]">2.</span>
              <span>Click <strong>Import and Export</strong> (bottom left sidebar)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-primary min-w-[20px]">3.</span>
              <span>Click <strong>Export Library</strong> to download your CSV file</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-primary min-w-[20px]">4.</span>
              <span>Upload the CSV file below</span>
            </div>
          </CardContent>
        </Card>

        <AnimatePresence mode="wait">
          {/* Phase 1: Upload */}
          {phase === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
                data-testid="file-input"
                aria-label="Select CSV file"
              />
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="upload-dropzone"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                aria-label="Upload CSV file"
              >
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">
                  {file ? file.name : 'Drag & drop your Goodreads CSV here'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : 'or click to browse'}
                </p>
              </div>

              {error && (
                <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2" data-testid="upload-error">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {file && (
                <div className="mt-4 flex gap-3">
                  <Button onClick={handleUpload} disabled={uploading} data-testid="upload-btn">
                    {uploading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-1.5" />
                        Upload & Preview
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => { setFile(null); setError(null); }}>
                    Clear
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* Phase 2: Preview */}
          {phase === 'preview' && preview && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <Card data-testid="import-preview">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Preview — {preview.totalRows} books found
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="preview-table">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4">Title</th>
                          <th className="text-left py-2 pr-4">Author</th>
                          <th className="text-left py-2 pr-4">Rating</th>
                          <th className="text-left py-2">Shelf</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview.map((row, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-2 pr-4 max-w-[200px] truncate">{row.title}</td>
                            <td className="py-2 pr-4 max-w-[150px] truncate">{row.author}</td>
                            <td className="py-2 pr-4">{row.rating !== '0' ? `${row.rating}★` : '—'}</td>
                            <td className="py-2 capitalize">{row.shelf || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.totalRows > 5 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing first 5 of {preview.totalRows} books
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button onClick={handleStartImport} data-testid="start-import-btn">
                  <ArrowRight className="h-4 w-4 mr-1.5" />
                  Start Import ({preview.totalRows} books)
                </Button>
                <Button variant="outline" onClick={handleReset}>Cancel</Button>
              </div>
            </motion.div>
          )}

          {/* Phase 3: Processing */}
          {phase === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card data-testid="import-processing">
                <CardContent className="pt-6 text-center space-y-4">
                  <RefreshCw className="h-8 w-8 text-primary mx-auto animate-spin" />
                  <h2 className="text-xl font-semibold">Importing your books…</h2>
                  {job && (
                    <>
                      {/* eslint-disable-next-line jsx-a11y/role-has-required-aria-props, jsx-a11y/aria-proptypes */}
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden" role="progressbar" aria-label="Import progress" aria-valuenow={job.processedRows} aria-valuemin={0} aria-valuemax={job.totalRows}>
                        {/* eslint-disable-next-line jsx-a11y/aria-proptypes */}
                        <div
                          className="bg-primary h-full transition-all duration-300 rounded-full"
                          style={{ width: `${job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {job.processedRows} / {job.totalRows} rows processed • {job.matchedBooks} matched
                      </p>
                    </>
                  )}
                  {!job && (
                    <p className="text-sm text-muted-foreground">Starting import…</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Phase 4: Results */}
          {phase === 'results' && job && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Summary */}
              <Card data-testid="import-results">
                <CardContent className="pt-6">
                  {job.status === 'completed' ? (
                    <div className="text-center mb-6">
                      <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
                      <h2 className="text-xl font-semibold">Import Complete!</h2>
                    </div>
                  ) : (
                    <div className="text-center mb-6">
                      <XCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
                      <h2 className="text-xl font-semibold">Import Failed</h2>
                      {job.errorMessage && (
                        <p className="text-sm text-destructive mt-1">{job.errorMessage}</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 text-center" data-testid="import-summary">
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950">
                      <div className="text-2xl font-bold text-green-600" data-testid="matched-count">{job.matchedBooks}</div>
                      <div className="text-xs text-muted-foreground">Matched</div>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950">
                      <div className="text-2xl font-bold text-amber-600" data-testid="skipped-count">{job.skippedRows}</div>
                      <div className="text-xs text-muted-foreground">Skipped</div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                      <div className="text-2xl font-bold text-blue-600" data-testid="total-count">{job.totalRows}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Skipped items */}
              {job.items.filter(it => it.status === 'skipped' || it.status === 'failed').length > 0 && (
                <Card data-testid="skipped-items">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Not Matched ({job.items.filter(it => it.status !== 'matched').length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {job.items
                        .filter(it => it.status === 'skipped' || it.status === 'failed')
                        .slice(0, 50)
                        .map((it, i) => (
                          <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                            <div className="truncate max-w-[60%]">
                              <span className="font-medium">{it.title}</span>
                              <span className="text-muted-foreground"> by {it.author}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{it.errorReason || 'Not found'}</span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-3">
                <Button onClick={handleReset} data-testid="import-again-btn">
                  <Upload className="h-4 w-4 mr-1.5" />
                  Import Another File
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/my-stats'}>
                  <BarChart3 className="h-4 w-4 mr-1.5" />
                  View Stats
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Import History */}
        {history.length > 0 && phase === 'upload' && (
          <Card data-testid="import-history">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Past Imports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history.map(j => (
                  <div key={j.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      {j.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : j.status === 'failed' ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{j.fileName}</span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {j.matchedBooks}/{j.totalRows} matched • {new Date(j.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
