import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, BookOpen, Search, CheckCircle2,
  GripVertical, X, ArrowUpDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { handleImgError } from '@/lib/imageUtils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { seriesApi, booksApi } from '@/api/client';
import { toast } from 'sonner';

const emptyForm = { name: '', description: '', coverImage: '', isComplete: false };

export function AdminSeries() {
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  // Series form dialog
  const [editSeries, setEditSeries] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Book management dialog
  const [manageSeries, setManageSeries] = useState<any>(null);
  const [seriesBooks, setSeriesBooks] = useState<any[]>([]);
  const [booksDialogOpen, setBooksDialogOpen] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  const [bookResults, setBookResults] = useState<any[]>([]);
  const [bookSearchLoading, setBookSearchLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await seriesApi.list({ page, limit: 20, search: search || undefined });
      setSeriesList(res.series);
      setPagination(res.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Series CRUD ─────────────────────────────────────────────────

  function openCreate() {
    setEditSeries(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(s: any) {
    setEditSeries(s);
    setForm({
      name: s.name || '',
      description: s.description || '',
      coverImage: s.coverImage || '',
      isComplete: s.isComplete ?? false,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    try {
      if (editSeries) {
        await seriesApi.update(editSeries.id, form);
        toast.success('Series updated');
      } else {
        await seriesApi.create(form);
        toast.success('Series created');
      }
      setDialogOpen(false);
      load();
    } catch (err: any) { toast.error(err.message || 'Failed'); }
  }

  async function handleDelete(id: string) {
    try {
      await seriesApi.delete(id);
      toast.success('Series deleted');
      setDeleteConfirm(null);
      load();
    } catch (err: any) { toast.error(err.message || 'Failed'); }
  }

  // ── Book Management ─────────────────────────────────────────────

  async function openManageBooks(s: any) {
    setManageSeries(s);
    setBooksDialogOpen(true);
    setBookSearch('');
    setBookResults([]);
    try {
      const res = await seriesApi.getBySlug(s.slug);
      setSeriesBooks(res.series.books.sort((a: any, b: any) => a.position - b.position));
    } catch (err) {
      toast.error('Failed to load series books');
      setSeriesBooks([]);
    }
  }

  async function searchBooks(q: string) {
    setBookSearch(q);
    if (q.length < 2) { setBookResults([]); return; }
    setBookSearchLoading(true);
    try {
      const res = await booksApi.search({ query: q, limit: 10 });
      // Filter out books already in series
      const existingIds = new Set(seriesBooks.map((b: any) => b.id));
      setBookResults((res.books || []).filter((b: any) => !existingIds.has(b.id)));
    } catch { setBookResults([]); }
    finally { setBookSearchLoading(false); }
  }

  async function addBookToSeries(bookId: string) {
    if (!manageSeries) return;
    const nextPos = seriesBooks.length > 0
      ? Math.max(...seriesBooks.map((b: any) => b.position)) + 1
      : 1;
    try {
      await seriesApi.addBook(manageSeries.id, { bookId, position: nextPos });
      toast.success('Book added to series');
      // Refresh
      const res = await seriesApi.getBySlug(manageSeries.slug);
      setSeriesBooks(res.series.books.sort((a: any, b: any) => a.position - b.position));
      setBookSearch('');
      setBookResults([]);
      load(); // refresh list for count
    } catch (err: any) { toast.error(err.message || 'Failed to add book'); }
  }

  async function removeBookFromSeries(bookId: string) {
    if (!manageSeries) return;
    try {
      await seriesApi.removeBook(manageSeries.id, bookId);
      toast.success('Book removed from series');
      setSeriesBooks((prev) => prev.filter((b: any) => b.id !== bookId));
      load(); // refresh list for count
    } catch (err: any) { toast.error(err.message || 'Failed'); }
  }

  async function updateBookPosition(bookId: string, newPosition: number) {
    if (!manageSeries) return;
    try {
      await seriesApi.updateBook(manageSeries.id, bookId, { position: newPosition });
      setSeriesBooks((prev) =>
        prev.map((b: any) => (b.id === bookId ? { ...b, position: newPosition } : b))
          .sort((a: any, b: any) => a.position - b.position)
      );
    } catch (err: any) { toast.error(err.message || 'Failed'); }
  }

  async function toggleMainEntry(bookId: string, current: boolean) {
    if (!manageSeries) return;
    try {
      await seriesApi.updateBook(manageSeries.id, bookId, { isMainEntry: !current });
      setSeriesBooks((prev) =>
        prev.map((b: any) => (b.id === bookId ? { ...b, isMainEntry: !current } : b))
      );
    } catch (err: any) { toast.error(err.message || 'Failed'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Book Series</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add Series</Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search series..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> {pagination.total} Series
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse h-14 bg-muted rounded" />
              ))}
            </div>
          ) : seriesList.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No series found. Create one to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4">Series</th>
                    <th className="pb-3 pr-4 hidden md:table-cell">Slug</th>
                    <th className="pb-3 pr-4">Books</th>
                    <th className="pb-3 pr-4 hidden sm:table-cell">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {seriesList.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          {s.coverImage && (
                            <img src={s.coverImage} alt={s.name} className="w-8 h-12 rounded object-cover" onError={handleImgError} />
                          )}
                          <div>
                            <p className="font-medium">{s.name}</p>
                            {s.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{s.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell text-muted-foreground font-mono text-xs">{s.slug}</td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80"
                          onClick={() => openManageBooks(s)}
                        >
                          {s.totalBooks || 0} books
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        {s.isComplete ? (
                          <Badge variant="outline" className="text-green-600 border-green-300 dark:text-green-400 dark:border-green-700 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Complete
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-300 dark:text-yellow-400 dark:border-yellow-700">
                            Ongoing
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openManageBooks(s)} title="Manage books">
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteConfirm(s.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pagination.pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create/Edit Series Dialog ────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editSeries ? 'Edit Series' : 'Create Series'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Harry Potter" />
            </div>
            <div className="space-y-2">
              <Label>Cover Image URL</Label>
              <Input value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} placeholder="https://..." />
              {form.coverImage && (
                <img src={form.coverImage} alt="Preview" className="w-16 h-24 rounded object-cover mt-1" onError={handleImgError} />
              )}
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of the series..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isComplete"
                checked={form.isComplete}
                onChange={(e) => setForm({ ...form, isComplete: e.target.checked })}
                className="rounded border-gray-300"
                title="Mark series as complete"
              />
              <Label htmlFor="isComplete">Series is complete (no more books expected)</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSave}>{editSeries ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ────────────────────────────────────── */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Series</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">
            This will remove the series and unlink all books from it. The books themselves won't be deleted. Continue?
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manage Books Dialog ──────────────────────────────────────── */}
      <Dialog open={booksDialogOpen} onOpenChange={(open) => { setBooksDialogOpen(open); if (!open) setManageSeries(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Books — {manageSeries?.name}
            </DialogTitle>
          </DialogHeader>

          {/* Search & add */}
          <div className="space-y-3">
            <Label>Add a book to this series</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search books by title..."
                value={bookSearch}
                onChange={(e) => searchBooks(e.target.value)}
                className="pl-9"
              />
            </div>
            {bookSearchLoading && (
              <p className="text-sm text-muted-foreground">Searching...</p>
            )}
            {bookResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {bookResults.map((b: any) => (
                  <div key={b.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addBookToSeries(b.id)}>
                    {b.coverImage && (
                      <img src={b.coverImage} alt={b.title} className="w-8 h-12 rounded object-cover" onError={handleImgError} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.author}</p>
                    </div>
                    <Plus className="h-4 w-4 text-primary shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Current books in series */}
          <div className="space-y-2">
            <Label>Books in series ({seriesBooks.length})</Label>
            {seriesBooks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No books in this series yet. Search above to add books.</p>
            ) : (
              <div className="space-y-2">
                {seriesBooks.map((b: any) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    {b.coverImage && (
                      <img src={b.coverImage} alt={b.title} className="w-8 h-12 rounded object-cover shrink-0" onError={handleImgError} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.authorData?.name || b.author}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        className="w-16 h-8 text-xs text-center"
                        value={b.position}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateBookPosition(b.id, val);
                        }}
                        title="Position in series"
                      />
                      <Button
                        variant={b.isMainEntry ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => toggleMainEntry(b.id, b.isMainEntry)}
                        title="Toggle main entry"
                      >
                        Main
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeBookFromSeries(b.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
