import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight,
  Star, BookOpen, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { booksApi, type BookResponse } from '@/api/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type BookRow = BookResponse;

export function AdminBooks() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<BookRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const limit = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await booksApi.list({ page, limit, search: search || undefined });
      setBooks(res.books);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  async function handleDelete(id: string) {
    try {
      await booksApi.delete(id);
      toast.success('Book deleted');
      setDeleteConfirm(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Books</h1>
        <Button onClick={() => navigate('/admin/books/new')}>
          <Plus className="h-4 w-4 mr-2" /> Add Book
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search books..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {total} Books
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse h-16 bg-muted rounded" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4">Book</th>
                    <th className="pb-3 pr-4 hidden md:table-cell">Author</th>
                    <th className="pb-3 pr-4 hidden lg:table-cell">Rating</th>
                    <th className="pb-3 pr-4 hidden lg:table-cell">SEO</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((book) => {
                    const hasSeo = !!(book.metaTitle && book.metaDescription);
                    return (
                      <tr key={book.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={book.coverImage}
                              alt={book.title}
                              className="w-10 h-14 rounded object-cover bg-muted"
                            />
                            <div>
                              <p className="font-medium line-clamp-1">{book.title}</p>
                              <p className="text-xs text-muted-foreground md:hidden">{book.author}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 hidden md:table-cell text-muted-foreground">{book.author}</td>
                        <td className="py-3 pr-4 hidden lg:table-cell">
                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                            <span>{book.googleRating}</span>
                            <span className="text-muted-foreground">({book.ratingsCount})</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 hidden lg:table-cell">
                          <Badge variant={hasSeo ? 'default' : 'outline'} className={hasSeo ? 'bg-green-600' : 'text-muted-foreground'}>
                            {hasSeo ? 'OK' : 'Missing'}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={book.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                            {book.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/admin/books/edit/${book.slug}`)}
                              title="Edit book"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" asChild title="View on site">
                              <a href={`/book/${book.slug}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteConfirm(book.id)} title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Book</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">Are you sure you want to delete this book? This action cannot be undone.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
