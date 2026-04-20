import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpenText, Edit3, Globe, Lock, NotebookPen, Quote, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, journalApi, type JournalEntryResponse, type JournalEntryType } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ReadingJournalProps {
  bookId: string;
}

const typeOptions: Array<{ value: JournalEntryType; label: string }> = [
  { value: 'note', label: 'Note' },
  { value: 'quote', label: 'Quote' },
  { value: 'highlight', label: 'Highlight' },
  { value: 'reaction', label: 'Reaction' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function ReadingJournal({ bookId }: ReadingJournalProps) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntryResponse[]>([]);
  const [filter, setFilter] = useState<'all' | JournalEntryType>('all');

  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entryType, setEntryType] = useState<JournalEntryType>('note');
  const [content, setContent] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [chapter, setChapter] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setEntries([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await journalApi.list(bookId);
      setEntries(result.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [bookId, isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((entry) => entry.entryType === filter);
  }, [entries, filter]);

  async function submitEntry() {
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error('Journal content is required');
      return;
    }

    try {
      setSubmitting(true);
      const result = await journalApi.create({
        bookId,
        content: trimmed,
        entryType,
        pageNumber: pageNumber ? Number.parseInt(pageNumber, 10) : null,
        chapter: chapter.trim() || null,
        isPrivate,
      });

      setEntries((prev) => [result.entry, ...prev]);
      setContent('');
      setPageNumber('');
      setChapter('');
      setEntryType('note');
      setIsPrivate(true);
      setComposerOpen(false);
      toast.success('Journal entry saved');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to save journal entry';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit(entryId: string) {
    const trimmed = editContent.trim();
    if (!trimmed) {
      toast.error('Journal content is required');
      return;
    }

    try {
      const result = await journalApi.update(entryId, { content: trimmed });
      setEntries((prev) => prev.map((entry) => (entry.id === entryId ? result.entry : entry)));
      setEditingId(null);
      setEditContent('');
      toast.success('Entry updated');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update entry';
      toast.error(message);
    }
  }

  async function deleteEntry(entryId: string) {
    try {
      await journalApi.remove(entryId);
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      toast.success('Entry deleted');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to delete entry';
      toast.error(message);
    }
  }

  if (!isAuthenticated) {
    return (
      <section className="rounded-2xl border border-dashed p-4" data-testid="reading-journal-guest">
        <h3 className="font-semibold flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-primary" />
          Reading Journal
        </h3>
        <p className="text-sm text-muted-foreground mt-2">Capture private notes and quotes while you read.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => openAuthModal('signin')}>
          Sign in to journal
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4" data-testid="reading-journal">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-primary" />
          Reading Journal
        </h3>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filter journal entries"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={filter}
            onChange={(event) => setFilter(event.target.value as 'all' | JournalEntryType)}
            data-testid="reading-journal-filter"
          >
            <option value="all">All Types</option>
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setComposerOpen(true)}
            data-testid="reading-journal-open-composer"
          >
            Add Entry
          </Button>
        </div>
      </div>

      {composerOpen && (
        <div
          className="fixed inset-0 z-50 bg-background p-4 overflow-y-auto sm:static sm:z-auto sm:border sm:rounded-xl"
          data-testid="reading-journal-composer"
        >
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold">New Journal Entry</h4>
              <Button size="sm" variant="ghost" onClick={() => setComposerOpen(false)}>Close</Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-sm">
                <span className="text-muted-foreground">Type</span>
                <select
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2"
                  value={entryType}
                  onChange={(event) => setEntryType(event.target.value as JournalEntryType)}
                  data-testid="reading-journal-type-select"
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm flex items-end gap-2">
                <input
                  type="checkbox"
                  checked={!isPrivate}
                  onChange={(event) => setIsPrivate(!event.target.checked)}
                  data-testid="reading-journal-public-toggle"
                />
                <span className="text-muted-foreground">Make public quote</span>
              </label>
            </div>

            <Textarea
              placeholder="Write your thought, quote, or reaction..."
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-32"
              maxLength={5000}
              data-testid="reading-journal-content"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                type="number"
                min={1}
                max={10000}
                value={pageNumber}
                onChange={(event) => setPageNumber(event.target.value)}
                placeholder="Page number (optional)"
                data-testid="reading-journal-page"
              />
              <Input
                value={chapter}
                onChange={(event) => setChapter(event.target.value)}
                maxLength={100}
                placeholder="Chapter (optional)"
                data-testid="reading-journal-chapter"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Supports basic markdown formatting.</p>
              <Button onClick={() => void submitEntry()} disabled={submitting} data-testid="reading-journal-submit">
                {submitting ? 'Saving...' : 'Save Entry'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-24 rounded-xl bg-muted animate-pulse" data-testid="reading-journal-loading" />
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground" data-testid="reading-journal-empty">
          No entries yet for this book.
        </div>
      ) : (
        <div className="space-y-3" data-testid="reading-journal-list">
          {filteredEntries.map((entry) => (
            <article key={entry.id} className="rounded-xl border p-3 space-y-2" data-testid={`reading-journal-entry-${entry.id}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{entry.entryType}</Badge>
                  {entry.isPrivate ? (
                    <span className="text-xs inline-flex items-center gap-1 text-muted-foreground">
                      <Lock className="h-3 w-3" /> Private
                    </span>
                  ) : (
                    <span className="text-xs inline-flex items-center gap-1 text-emerald-700">
                      <Globe className="h-3 w-3" /> Public
                    </span>
                  )}
                  {entry.pageNumber && (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <BookOpenText className="h-3 w-3" /> p.{entry.pageNumber}
                    </span>
                  )}
                  {entry.chapter && <span className="text-xs text-muted-foreground">{entry.chapter}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
              </div>

              {editingId === entry.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(event) => setEditContent(event.target.value)}
                    className="min-h-24"
                    maxLength={5000}
                    data-testid={`reading-journal-edit-content-${entry.id}`}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => void saveEdit(entry.id)} data-testid={`reading-journal-edit-save-${entry.id}`}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditContent(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={cn('text-sm whitespace-pre-wrap leading-relaxed', entry.entryType === 'quote' && 'italic')}>
                  {entry.entryType === 'quote' ? (
                    <span className="inline-flex items-start gap-1"><Quote className="h-3 w-3 mt-1 shrink-0" /> {entry.content}</span>
                  ) : entry.content}
                </p>
              )}

              {editingId !== entry.id && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditingId(entry.id); setEditContent(entry.content); }}
                    data-testid={`reading-journal-edit-${entry.id}`}
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-foreground hover:text-destructive"
                    onClick={() => void deleteEntry(entry.id)}
                    data-testid={`reading-journal-delete-${entry.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
