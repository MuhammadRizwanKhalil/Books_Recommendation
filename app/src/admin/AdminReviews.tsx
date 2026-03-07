import { useEffect, useState, useCallback } from 'react';
import {
  Check, X, Trash2, ChevronLeft, ChevronRight, Star, MessageSquare, Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { reviewsApi } from '@/api/client';
import { toast } from 'sonner';

export function AdminReviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const approved = filter === 'all' ? undefined : filter === 'approved' ? true : false;
      const res = await reviewsApi.listAll(page, approved);
      setReviews(res.reviews);
      setTotal(res.pagination?.total || res.reviews.length);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);
  const totalPages = Math.ceil(total / limit);

  async function handleApprove(id: number, approved: boolean) {
    try {
      await reviewsApi.approve(String(id), approved);
      toast.success(approved ? 'Review approved' : 'Review rejected');
      load();
    } catch (err: any) { toast.error(err.message || 'Failed'); }
  }

  async function handleDelete(id: number) {
    try {
      await reviewsApi.delete(String(id));
      toast.success('Review deleted');
      setDeleteConfirm(null);
      load();
    } catch (err: any) { toast.error(err.message || 'Failed'); }
  }

  function renderStars(rating: number) {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`h-3 w-3 ${i < rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Reviews</h1>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reviews</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> {total} Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse h-20 bg-muted rounded" />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No reviews found</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border rounded-lg p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium">{review.userName || 'Anonymous'}</span>
                        {renderStars(review.rating)}
                        <Badge variant={review.isApproved ? 'default' : 'secondary'}>
                          {review.isApproved ? 'Approved' : 'Pending'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        on <span className="font-medium text-foreground">{review.bookTitle || `Book #${review.bookId}`}</span>
                        {' · '}{new Date(review.createdAt).toLocaleDateString()}
                      </p>
                      {review.title && <p className="text-sm font-medium mt-1">{review.title}</p>}
                      <p className="text-sm text-muted-foreground">{review.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">{review.helpfulCount} helpful votes</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!review.isApproved && (
                        <Button variant="ghost" size="icon" className="text-green-600" onClick={() => handleApprove(review.id, true)} title="Approve">
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      {review.isApproved && (
                        <Button variant="ghost" size="icon" className="text-orange-500" onClick={() => handleApprove(review.id, false)} title="Reject">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="text-destructive" title="Delete" onClick={() => setDeleteConfirm(review.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
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
          <DialogHeader><DialogTitle>Delete Review</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
