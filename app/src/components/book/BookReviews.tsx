import { useState, useEffect, useCallback, useRef } from 'react';
import { Star, ThumbsUp, MessageSquare, Loader2, Pencil, Trash2, ShieldCheck, AlertTriangle, Eye, EyeOff, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useReviews } from '@/components/ReviewProvider';
import { useAuth } from '@/components/AuthProvider';
import { StarDisplay } from '@/components/ui/star-display';
import { formatDate } from '@/lib/utils';
import { ReviewFilters, type ReviewFiltersState } from './ReviewFilters';
import { ReviewComments } from './ReviewComments';
import { FollowButton } from '@/components/FollowButton';
import { Link } from 'react-router-dom';

interface BookReviewsProps {
  bookId: string;
}

export function BookReviews({ bookId }: BookReviewsProps) {
  const { getReviewsForBook, getAverageRating, getPagination, addReview, editReview, deleteReview, markHelpful, hasUserReviewed, fetchReviewsForBook, reviewsLoading } =
    useReviews();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  
  // Fetch reviews from backend on mount
  useEffect(() => {
    fetchReviewsForBook(bookId);
  }, [bookId, fetchReviewsForBook]);

  const reviews = getReviewsForBook(bookId);
  const { avg, count } = getAverageRating(bookId);
  const pagination = getPagination(bookId);

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [spoilerText, setSpoilerText] = useState('');
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<ReviewFiltersState>({ q: '', rating: undefined, sort: 'helpful', hasSpoiler: undefined });
  const filtersActiveRef = useRef(false);

  const hasActiveFilters = !!(activeFilters.q || activeFilters.rating !== undefined || activeFilters.hasSpoiler !== undefined);
  filtersActiveRef.current = hasActiveFilters || activeFilters.sort !== 'helpful';

  const handleFiltersChange = useCallback((filters: ReviewFiltersState) => {
    setActiveFilters(filters);
    // Always fetch from server when filters or sort change
    fetchReviewsForBook(bookId, {
      q: filters.q || undefined,
      rating: filters.rating,
      sort: filters.sort,
      hasSpoiler: filters.hasSpoiler,
      includeSpoilers: true,
    });
  }, [bookId, fetchReviewsForBook]);

  const alreadyReviewed = user ? hasUserReviewed(bookId, user.id) : false;

  const startEdit = (review: { id: string; rating: number; title: string; content: string; hasSpoiler?: boolean; spoilerText?: string | null }) => {
    setEditingReviewId(review.id);
    setRating(review.rating);
    setTitle(review.title);
    setContent(review.content);
    setHasSpoiler(!!review.hasSpoiler);
    setSpoilerText(review.spoilerText || '');
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingReviewId(null);
    setRating(0);
    setTitle('');
    setContent('');
    setHasSpoiler(false);
    setSpoilerText('');
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
      await editReview(editingReviewId, bookId, { rating, title: title.trim(), content: content.trim(), hasSpoiler, spoilerText: hasSpoiler ? spoilerText.trim() || null : null });
    } else {
      await addReview({
        bookId,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        rating,
        title: title.trim(),
        content: content.trim(),
        hasSpoiler,
        spoilerText: hasSpoiler ? spoilerText.trim() || null : null,
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
              {Array.from({ length: 5 }).map((_, i) => {
                const starNum = i + 1;
                return (
                <button
                  key={i}
                  type="button"
                  className="relative p-0.5"
                  aria-label={`Rate ${starNum} star${i > 0 ? 's' : ''}`}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const isLeftHalf = x < rect.width / 2;
                    setHoverRating(isLeftHalf ? starNum - 0.5 : starNum);
                  }}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const isLeftHalf = x < rect.width / 2;
                    setRating(isLeftHalf ? starNum - 0.5 : starNum);
                  }}
                >
                  <Star className="h-7 w-7 text-gray-300" />
                  {starNum <= (hoverRating || rating) && (
                    <Star className="h-7 w-7 fill-yellow-400 text-yellow-400 absolute inset-0 m-[2px]" />
                  )}
                  {starNum > (hoverRating || rating) && starNum - 0.5 <= (hoverRating || rating) && (hoverRating || rating) > 0 && (
                    <div className="absolute inset-0 m-[2px] overflow-hidden w-1/2">
                      <Star className="h-7 w-7 fill-yellow-400 text-yellow-400" />
                    </div>
                  )}
                </button>
                );
              })}
              {rating > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {rating <= 1 ? 'Poor' : rating <= 2 ? 'Fair' : rating <= 3 ? 'Good' : rating <= 4 ? 'Very Good' : 'Excellent'}
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

          {/* Spoiler checkbox */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasSpoiler}
                onChange={(e) => setHasSpoiler(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Contains spoilers
              </span>
            </label>
            {hasSpoiler && (
              <div className="pl-6">
                <Label htmlFor="spoiler-text" className="text-xs text-muted-foreground">Spoiler details (optional — hidden by default)</Label>
                <Textarea
                  id="spoiler-text"
                  placeholder="Describe the spoiler content here..."
                  rows={3}
                  value={spoilerText}
                  onChange={(e) => setSpoilerText(e.target.value)}
                  maxLength={5000}
                  className="mt-1"
                />
              </div>
            )}
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

      {/* Review Filters */}
      {count > 0 && (
        <ReviewFilters
          totalReviews={pagination?.total ?? count}
          totalFiltered={pagination?.totalFiltered ?? reviews.length}
          onFiltersChange={handleFiltersChange}
          isFiltering={reviewsLoading}
        />
      )}

      {/* Review List */}
      {reviewsLoading ? (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Loading reviews...</p>
        </div>
      ) : reviews.length === 0 ? (
        hasActiveFilters ? (
          <div className="text-center py-8" data-testid="no-filter-results">
            <SearchX className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No reviews match your search</p>
            <p className="text-xs text-muted-foreground mt-1">Try different keywords or clear your filters</p>
          </div>
        ) : (
          <div className="text-center py-8">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No reviews yet. Be the first to share your thoughts!</p>
          </div>
        )
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
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
                    {review.userId ? (
                      <Link to={`/users/${review.userId}`} className="font-semibold text-sm hover:text-primary">
                        {review.userName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-sm">{review.userName}</span>
                    )}
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
                    <StarDisplay rating={review.rating} size="sm" />
                  </div>
                </div>
              </div>
              <div className="pl-12">
                <p className="font-semibold text-sm">{review.title}</p>
                {review.hasSpoiler && !revealedSpoilers.has(review.id) ? (
                  <div className="mt-1 space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>This review contains spoilers</span>
                    </div>
                    <div
                      className="relative select-none blur-sm"
                      aria-hidden="true"
                    >
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {review.content}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 gap-1"
                      onClick={() => setRevealedSpoilers(prev => new Set(prev).add(review.id))}
                      aria-label="Spoiler content hidden. Press to reveal."
                    >
                      <Eye className="h-3 w-3" />
                      Show Spoiler
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1">
                    {review.hasSpoiler && (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-medium mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Contains spoilers</span>
                        <button
                          onClick={() => setRevealedSpoilers(prev => { const s = new Set(prev); s.delete(review.id); return s; })}
                          className="ml-1 text-muted-foreground hover:text-foreground"
                          aria-label="Hide spoiler content"
                        >
                          <EyeOff className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {review.content}
                    </p>
                    {review.hasSpoiler && review.spoilerText && (
                      <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-muted-foreground leading-relaxed">
                        {review.spoilerText}
                      </div>
                    )}
                    {review.authorResponse?.content && (
                      <div className="mt-3 p-3 border rounded-lg bg-muted/40" data-testid={`author-response-${review.id}`}>
                        <p className="text-xs font-semibold text-foreground mb-1">Author Response</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{review.authorResponse.content}</p>
                        {review.authorResponse.respondedAt && (
                          <p className="text-[11px] text-muted-foreground mt-2">{formatDate(review.authorResponse.respondedAt)}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-1 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-muted-foreground"
                    onClick={() => markHelpful(review.id)}
                  >
                    <ThumbsUp className="h-3 w-3 mr-1" />
                    Helpful ({review.helpful})
                  </Button>
                  {review.userId && (
                    <FollowButton
                      userId={review.userId}
                      initialFollowing={false}
                      initialFollowerCount={0}
                      size="sm"
                      testId={`review-follow-button-${review.userId}`}
                    />
                  )}
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
                <ReviewComments reviewId={review.id} />
              </div>
              <Separator className="mt-3" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
