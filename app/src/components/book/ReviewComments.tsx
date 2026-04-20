import { useState, useCallback, useEffect } from 'react';
import { MessageCircle, Loader2, Pencil, Trash2, Reply, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { reviewCommentsApi, type ReviewComment } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface ReviewCommentsProps {
  reviewId: string;
}

const MAX_INDENT_DEPTH = 3;

function CommentNode({
  comment,
  depth,
  user,
  isAuthenticated,
  openAuthModal,
  onReply,
  onEdit,
  onDelete,
}: {
  comment: ReviewComment;
  depth: number;
  user: any;
  isAuthenticated: boolean;
  openAuthModal: (mode: string) => void;
  onReply: (parentId: string) => void;
  onEdit: (comment: ReviewComment) => void;
  onDelete: (commentId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(depth >= MAX_INDENT_DEPTH);
  const indent = Math.min(depth, MAX_INDENT_DEPTH);

  return (
    <div
      className={indent > 0 ? 'ml-4 sm:ml-6 pl-3 border-l border-border/50' : ''}
      data-testid="comment-node"
    >
      <div className="py-2">
        <div className="flex items-start gap-2">
          <Avatar className="h-6 w-6 flex-shrink-0">
            <AvatarImage src={comment.user.avatarUrl || undefined} alt={comment.user.name} />
            <AvatarFallback className="text-[10px]">
              {comment.user.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold">{comment.user.name}</span>
              <span className="text-[10px] text-muted-foreground">{formatDate(comment.createdAt)}</span>
              {comment.isEdited && (
                <span className="text-[10px] text-muted-foreground italic">(edited)</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed break-words">
              {comment.content}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] h-5 px-1.5 text-muted-foreground"
                onClick={() => {
                  if (!isAuthenticated) {
                    openAuthModal('signin');
                    return;
                  }
                  onReply(comment.id);
                }}
              >
                <Reply className="h-3 w-3 mr-0.5" />
                Reply
              </Button>
              {user && comment.user.id === user.id && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] h-5 px-1.5 text-muted-foreground"
                    onClick={() => onEdit(comment)}
                  >
                    <Pencil className="h-3 w-3 mr-0.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] h-5 px-1.5 text-destructive"
                    onClick={() => onDelete(comment.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-0.5" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies.length > 0 && (
        <>
          {depth >= MAX_INDENT_DEPTH && collapsed ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-5 text-muted-foreground ml-8"
              onClick={() => setCollapsed(false)}
            >
              <ChevronDown className="h-3 w-3 mr-0.5" />
              Show {comment.replies.length} repl{comment.replies.length === 1 ? 'y' : 'ies'}
            </Button>
          ) : (
            <>
              {depth >= MAX_INDENT_DEPTH && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-5 text-muted-foreground ml-8"
                  onClick={() => setCollapsed(true)}
                >
                  <ChevronUp className="h-3 w-3 mr-0.5" />
                  Collapse
                </Button>
              )}
              {comment.replies.map(reply => (
                <CommentNode
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                  user={user}
                  isAuthenticated={isAuthenticated}
                  openAuthModal={openAuthModal}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

export function ReviewComments({ reviewId }: ReviewCommentsProps) {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Comment form state
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch comment count on mount
  useEffect(() => {
    reviewCommentsApi.getForReview(reviewId).then(res => {
      setTotalComments(res.totalComments);
    }).catch(() => {});
  }, [reviewId]);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reviewCommentsApi.getForReview(reviewId);
      setComments(res.comments);
      setTotalComments(res.totalComments);
      setLoaded(true);
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  const toggleExpanded = () => {
    if (!expanded && !loaded) {
      loadComments();
    }
    setExpanded(!expanded);
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await reviewCommentsApi.update(editingId, { content: newComment.trim() });
        toast.success('Comment updated');
      } else {
        await reviewCommentsApi.create(reviewId, {
          content: newComment.trim(),
          parentCommentId: replyTo || undefined,
        });
        toast.success('Comment posted');
      }
      setNewComment('');
      setReplyTo(null);
      setEditingId(null);
      await loadComments();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = (parentId: string) => {
    setReplyTo(parentId);
    setEditingId(null);
    setNewComment('');
  };

  const handleEdit = (comment: ReviewComment) => {
    setEditingId(comment.id);
    setNewComment(comment.content);
    setReplyTo(null);
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment? This will also remove any replies.')) return;
    try {
      await reviewCommentsApi.delete(commentId);
      toast.success('Comment deleted');
      await loadComments();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete comment');
    }
  };

  const cancelForm = () => {
    setNewComment('');
    setReplyTo(null);
    setEditingId(null);
  };

  return (
    <div className="mt-2" data-testid="review-comments">
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="sm"
        className="text-xs h-7 text-muted-foreground gap-1"
        onClick={toggleExpanded}
        data-testid="toggle-comments"
      >
        <MessageCircle className="h-3 w-3" />
        {totalComments > 0
          ? `${totalComments} comment${totalComments !== 1 ? 's' : ''}`
          : 'Comment'}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>

      {expanded && (
        <div className="mt-2 space-y-2 pl-2" data-testid="comments-panel">
          {loading && !loaded ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading comments...
            </div>
          ) : comments.length === 0 && !editingId && !replyTo ? (
            <p className="text-xs text-muted-foreground py-2" data-testid="no-comments">
              Be the first to comment
            </p>
          ) : (
            <div>
              {comments.map(comment => (
                <CommentNode
                  key={comment.id}
                  comment={comment}
                  depth={0}
                  user={user}
                  isAuthenticated={isAuthenticated}
                  openAuthModal={openAuthModal}
                  onReply={handleReply}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Comment input */}
          {isAuthenticated ? (
            <div className="space-y-2" data-testid="comment-form">
              {replyTo && (
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Reply className="h-3 w-3" />
                  Replying to a comment
                  <button onClick={cancelForm} className="text-primary hover:underline ml-1">Cancel</button>
                </div>
              )}
              {editingId && (
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Pencil className="h-3 w-3" />
                  Editing comment
                  <button onClick={cancelForm} className="text-primary hover:underline ml-1">Cancel</button>
                </div>
              )}
              <Textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                maxLength={2000}
                className="text-sm min-h-[60px]"
                aria-label="Comment text"
                data-testid="comment-textarea"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{newComment.length}/2,000</span>
                <div className="flex gap-1">
                  {(replyTo || editingId) && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={cancelForm}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-6 text-xs"
                    onClick={handleSubmit}
                    disabled={submitting || !newComment.trim()}
                    data-testid="submit-comment"
                  >
                    {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    {editingId ? 'Update' : replyTo ? 'Reply' : 'Comment'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2" data-testid="signin-prompt">
              <button
                onClick={() => openAuthModal('signin')}
                className="text-primary hover:underline"
              >
                Sign in
              </button>{' '}
              to comment
            </p>
          )}
        </div>
      )}
    </div>
  );
}
