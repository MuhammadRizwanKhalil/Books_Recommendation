import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, MessageSquare, Pin, Send } from 'lucide-react';
import { toast } from 'sonner';
import { discussionsApi, type DiscussionDetailResponse, type DiscussionReplyResponse, ApiError } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function ReplyItem({ reply }: { reply: DiscussionReplyResponse }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={reply.user.avatarUrl || undefined} alt={reply.user.name} />
          <AvatarFallback>{initials(reply.user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-sm font-medium">{reply.user.name}</div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reply.content}</p>
        </div>
      </div>
    </div>
  );
}

export function DiscussionThread() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, openAuthModal } = useAuth();
  const [thread, setThread] = useState<DiscussionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;

    discussionsApi.getThread(id)
      .then((data) => {
        if (alive) setThread(data);
      })
      .catch(() => {
        if (alive) setThread(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [id]);

  const handleReply = async () => {
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }

    if (!reply.trim()) {
      toast.error('Reply content is required');
      return;
    }

    setSubmitting(true);
    try {
      const created = await discussionsApi.reply(id, { content: reply.trim() });
      setThread((prev) => prev ? {
        ...prev,
        replyCount: prev.replyCount + 1,
        lastActivityAt: created.createdAt,
        replies: [...prev.replies, created],
      } : prev);
      setReply('');
      toast.success('Reply posted');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to post reply';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Loading discussion...</div>;
  }

  if (!thread) {
    return <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Discussion not found.</div>;
  }

  return (
    <div data-testid="discussion-thread-page" className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate(thread.book?.slug ? `/book/${thread.book.slug}` : '/')}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {thread.book && (
          <Link to={`/book/${thread.book.slug}`} className="text-sm text-primary hover:underline">
            {thread.book.title}
          </Link>
        )}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {thread.isPinned && (
              <Badge variant="secondary" className="gap-1">
                <Pin className="h-3 w-3" />
                Pinned
              </Badge>
            )}
            {thread.isLocked && (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" />
                Locked
              </Badge>
            )}
          </div>
          <CardTitle className="text-2xl">{thread.title}</CardTitle>
          <div className="text-sm text-muted-foreground">
            Started by <Link to={`/users/${thread.user.id}`} className="hover:text-primary">{thread.user.name}</Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{thread.content}</p>

          {thread.isLocked && (
            <div data-testid="discussion-locked-banner" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              This discussion is locked. New replies are disabled.
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5 text-primary" />
          Replies ({thread.replies.length})
        </h2>

        {thread.replies.length === 0 ? (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">No replies yet.</div>
        ) : (
          <div className="space-y-3">
            {thread.replies.map((item) => (
              <ReplyItem key={item.id} reply={item} />
            ))}
          </div>
        )}
      </section>

      {!thread.isLocked && (
        isAuthenticated && !isLoading ? (
          <Card data-testid="discussion-reply-form">
            <CardHeader>
              <CardTitle className="text-base">Add a reply</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                data-testid="discussion-reply-input"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={4}
                maxLength={3000}
                placeholder="Share your thoughts"
              />
              <div className="flex justify-end">
                <Button data-testid="discussion-reply-submit" onClick={handleReply} disabled={submitting} className="gap-2">
                  <Send className="h-4 w-4" />
                  {submitting ? 'Posting...' : 'Post reply'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Button variant="outline" onClick={() => openAuthModal('signin')}>
                Sign in to reply
              </Button>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
