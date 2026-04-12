/**
 * BookQuotes Component
 *
 * Displays top approved quotes for a book.
 * Authenticated users can submit new quotes and upvote existing ones.
 *
 * Usage: <BookQuotes bookId={book.id} />
 */

import { useState, useEffect } from 'react';
import { Quote, ThumbsUp, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/AuthProvider';

// Internal API helper — matches the pattern used across the app
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('thebooktimes-token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const base = (import.meta.env.VITE_API_URL || '/api');
  const res = await fetch(`${base}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

interface BookQuote {
  id: string;
  quote: string;
  page_number?: number;
  upvotes: number;
  submitter_name?: string;
  submitter_avatar?: string;
  created_at: string;
}

interface Props {
  bookId: string;
}

export function BookQuotes({ bookId }: Props) {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<BookQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newQuote, setNewQuote] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchQuotes();
  }, [bookId]);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/quotes/${bookId}`);
      setQuotes(data || []);
    } catch {
      // Silently fail — quotes are non-critical
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newQuote.trim() || newQuote.trim().length < 10) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiClient.post(`/quotes/${bookId}`, {
        quote: newQuote.trim(),
        page_number: pageNumber ? parseInt(pageNumber, 10) : undefined,
      });
      setSuccessMsg(result.message || 'Quote submitted!');
      setNewQuote('');
      setPageNumber('');
      setShowForm(false);
      await fetchQuotes();
    } catch (err: any) {
      setError(err.message || 'Failed to submit quote. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = async (quoteId: string) => {
    if (!user || upvoted.has(quoteId)) return;
    try {
      const result = await apiFetch<{ upvotes: number }>(`/quotes/${quoteId}/upvote`, { method: 'POST' });
      setUpvoted(prev => new Set([...prev, quoteId]));
      setQuotes(prev =>
        prev.map(q => q.id === quoteId ? { ...q, upvotes: result.upvotes } : q),
      );
    } catch {}
  };

  if (loading) return null;
  if (quotes.length === 0 && !user) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Quote className="h-5 w-5 text-primary" />
          Memorable Quotes
          {quotes.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({quotes.length})</span>
          )}
        </h3>
        {user && !showForm && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Quote
          </Button>
        )}
      </div>

      {/* Submit Form */}
      {showForm && (
        <div className="border rounded-xl p-4 mb-4 bg-muted/30 space-y-3">
          <p className="text-sm text-muted-foreground">Share a quote that stayed with you:</p>
          <Textarea
            value={newQuote}
            onChange={e => setNewQuote(e.target.value)}
            placeholder="Type the quote here..."
            className="min-h-[80px] resize-none"
            maxLength={1000}
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={pageNumber}
              onChange={e => setPageNumber(e.target.value)}
              placeholder="Page (optional)"
              className="w-28 px-3 py-1.5 text-sm border rounded-md bg-background"
              min={1}
              max={9999}
            />
            <span className="text-xs text-muted-foreground ml-auto">
              {newQuote.length}/1000
            </span>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={newQuote.trim().length < 10 || submitting}
              onClick={handleSubmit}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Submitting...' : 'Submit Quote'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowForm(false); setError(null); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMsg && (
        <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded-lg mb-4">
          ✓ {successMsg}
        </div>
      )}

      {/* Quotes List */}
      {quotes.length > 0 ? (
        <div className="space-y-3">
          {quotes.map(q => (
            <div
              key={q.id}
              className="border rounded-xl p-4 bg-card hover:border-primary/30 transition-colors"
            >
              <blockquote className="text-sm leading-relaxed text-foreground/90 italic mb-3">
                "{q.quote}"
              </blockquote>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {q.submitter_name && (
                    <span>— {q.submitter_name}</span>
                  )}
                  {q.page_number && (
                    <span className="bg-muted rounded px-1.5 py-0.5">p. {q.page_number}</span>
                  )}
                </div>
                {user && (
                  <button
                    onClick={() => handleUpvote(q.id)}
                    disabled={upvoted.has(q.id)}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors
                      ${upvoted.has(q.id)
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}
                  >
                    <ThumbsUp className="h-3 w-3" />
                    {q.upvotes}
                  </button>
                )}
                {!user && q.upvotes > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ThumbsUp className="h-3 w-3" />
                    {q.upvotes}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        user && (
          <p className="text-sm text-muted-foreground text-center py-6 border rounded-xl">
            No quotes yet. Be the first to share one!
          </p>
        )
      )}
    </section>
  );
}
