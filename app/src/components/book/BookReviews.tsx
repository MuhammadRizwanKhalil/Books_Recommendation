import { useState, useEffect } from 'react';
import { Star, ThumbsUp, MessageSquare, Loader2, Pencil, Trash2, ShieldCheck, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReviews } from '@/components/ReviewProvider';
import { useAuth } from '@/components/AuthProvider';
import { formatDate } from '@/lib/utils';

interface BookReviewsProps {
  bookId: string;
}

export function BookReviews({ bookId }: BookReviewsProps) {
  const { getReviewsForBook, getAverageRating, addReview, editReview, deleteReview, markHelpful, hasUserReviewed, fetchReviewsForBook, reviewsLoading } =
    useReviews();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  
  // Fetch reviews from backend on mount
  useEffect(() => {
    fetchReviewsForBook(bookId);
  }, [bookId, fetchReviewsForBook]);

  const reviews = getReviewsForBook(bookId);
  const { avg, count } = getAverageRating(bookId);

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('helpful');

  const alreadyReviewed = user ? hasUserReviewed(bookId, user.id) : false;

  // Sort reviews based on selected sort option
  const sortedReviews = [...reviews].sort((a, b) => {
    switch (sortBy) {
      case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'highest': return b.rating - a.rating || (b.helpful || 0) - (a.helpful || 0);
      case 'lowest': return a.rating - b.rating || (b.helpful || 0) - (a.helpful || 0);
      case 'helpful':
      default: return (b.helpful || 0) - (a.helpful || 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const startEdit = (review: { id: string; rating: number; title: string; content: string }) => {
    setEditingReviewId(review.id);
    setRating(review.rating);
    setTitle(review.title);
    setContent(review.content);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingReviewId(null);
    setRating(0);
    setTitle('');
    setContent('');
    setShowForm(false);
  };

  // Rating distribution
  const ratingDist = [5, 4, 3, 2, 1].map((star) => {
    const c = reviews.filter((r) => r.rating === star).length;
    return { star, count: c, pct: count > 0 ? (c / count) * 100 : 0 };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || rating === 0 || !title.trim() || !content.trim()) return;

    setSubmitting(true);
    if (editingReviewId) {
      await editReview(editingReviewId, bookId, { rating, title: title.trim(), content: content.trim() });
    } else {
      await addReview({
        bookId,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        rating,
        title: title.trim(),
        content: content.trim(),
      });
    }
    cancelEdit();
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Reviews ({count})
        </h3>
        {!alreadyReviewed && !editingReviewId && (
          <Button
            size="sm"
            onClick={() => {
              if (!isAuthenticated) {
                openAuthModal('signin');
                return;
              }
              setShowForm(!showForm);
            }}
          >
            Write a Review
          </Button>
        )}
      </div>

      {/* Rating Summary */}
      {count > 0 && (
        <div className="flex flex-col sm:flex-row gap-6 p-4 bg-muted/50 rounded-lg">
          <div className="text-center sm:text-left sm:pr-6 sm:border-r">
            <p className="text-4xl font-bold">{avg.toFixed(1)}</p>
            <div className="flex items-center justify-center sm:justify-start gap-0.5 my-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.round(avg)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{count} review{count !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {ratingDist.map((d) => (
              <div key={d.star} className="flex items-center gap-2 text-sm">
                <span className="w-8 text-right">{d.star}★</span>
                <Progress value={d.pct} className="h-2 flex-1" />
                <span className="w-8 text-muted-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card">
          <div className="space-y-2">
            <Label>Your Rating *</Label>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setHoverRating(i + 1)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(i + 1)}
                  className="p-0.5"
                  aria-label={`Rate ${i + 1} star${i > 0 ? 's' : ''}`}
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      i < (hoverRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-title">Review Title *</Label>
            <Input
              id="review-title"
              placeholder="Sum up your review in a headline"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-content">Your Review *</Label>
            <Textarea
              id="review-content"
              placeholder="What did you like or dislike? How did this book impact you? (minimum 20 characters)"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{content.length < 20 ? `${20 - content.length} more characters needed` : '✓ Minimum met'}</span>
              <span>{content.length}/5,000</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || rating === 0 || !title.trim() || content.trim().length < 20}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingReviewId ? 'Update Review' : 'Submit Review'}
            </Button>
          </div>
        </form>
      )}

      <Separator />

      {/* Sort Controls */}
      {reviews.length > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <ArrowUpDown className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="helpful">Most Helpful</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="highest">Highest Rated</SelectItem>
              <SelectItem value="lowest">Lowest Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Review List */}
      {reviewsLoading ? (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Loading reviews...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No reviews yet. Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedReviews.map((review) => (
            <div key={review.id} className="space-y-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={review.userAvatar} alt={review.userName} />
                  <AvatarFallback>
                    {review.userName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{review.userName}</span>
                    {review.userId && (
                      <Badge variant="secondary" className="text-[10px] h-5 gap-0.5 px-1.5">
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < review.rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="pl-12">
                <p className="font-semibold text-sm">{review.title}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {review.content}
                </p>
                <div className="mt-3 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-muted-foreground"
                    onClick={() => markHelpful(review.id)}
                  >
                    <ThumbsUp className="h-3 w-3 mr-1" />
                    Helpful ({review.helpful})
                  </Button>
                  {user && review.userId === user.id && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-muted-foreground"
                        onClick={() => startEdit(review)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-destructive"
                        onClick={() => deleteReview(review.id, bookId)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <Separator className="mt-3" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
