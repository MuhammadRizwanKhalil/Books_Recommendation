import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, MessageSquare, Pin, Search, Send } from 'lucide-react';
import { toast } from 'sonner';
import { discussionsApi, type DiscussionSummaryResponse, ApiError } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface BookDiscussionsProps {
  bookId: string;
}

function sortDiscussions(items: DiscussionSummaryResponse[]) {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function BookDiscussions({ bookId }: BookDiscussionsProps) {
  const { isAuthenticated, isLoading, openAuthModal } = useAuth();
  const [discussions, setDiscussions] = useState<DiscussionSummaryResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;

    discussionsApi.listByBook(bookId)
      .then((data) => {
        if (!alive) return;
        setDiscussions(sortDiscussions(data.discussions || []));
        setTotal(Number(data.total || 0));
      })
      .catch(() => {
        if (!alive) return;
        setDiscussions([]);
        setTotal(0);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [bookId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return discussions;

    return discussions.filter((discussion) => (
      discussion.title.toLowerCase().includes(query)
      || discussion.content.toLowerCase().includes(query)
      || discussion.user.name.toLowerCase().includes(query)
    ));
  }, [discussions, search]);

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }

    if (!title.trim() || !content.trim()) {
      toast.error('Please add both a title and message.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await discussionsApi.create(bookId, {
        title: title.trim(),
        content: content.trim(),
      });

      setDiscussions((prev) => sortDiscussions([created, ...prev]));
      setTotal((prev) => prev + 1);
      setTitle('');
      setContent('');
      toast.success('Discussion created');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create discussion';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section data-testid="book-discussions-section" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 data-testid="book-discussions-heading" className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Discussions ({total})
        </h2>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="discussion-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search discussions"
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start a discussion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAuthenticated && !isLoading ? (
            <>
              <Input
                data-testid="new-discussion-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Thread title"
                maxLength={300}
              />
              <Textarea
                data-testid="new-discussion-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What would you like to talk about?"
                rows={4}
                maxLength={5000}
              />
              <div className="flex justify-end">
                <Button data-testid="new-discussion-submit" onClick={handleSubmit} disabled={submitting} className="gap-2">
                  <Send className="h-4 w-4" />
                  {submitting ? 'Posting...' : 'Post discussion'}
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Join the conversation to ask questions, share theories, or talk about favorite moments.
              <div className="mt-3">
                <Button variant="outline" onClick={() => openAuthModal('signin')}>
                  Sign in to post
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Loading discussions...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          {search.trim() ? 'No discussions match your search yet.' : 'No discussions yet. Be the first to start one.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((discussion) => (
            <article key={discussion.id} data-testid="discussion-thread-card" className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={discussion.user.avatarUrl || undefined} alt={discussion.user.name} />
                  <AvatarFallback>{initials(discussion.user.name)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {discussion.isPinned && (
                      <Badge variant="secondary" className="gap-1">
                        <Pin className="h-3 w-3" />
                        Pinned
                      </Badge>
                    )}
                    {discussion.isLocked && (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" />
                        Locked
                      </Badge>
                    )}
                  </div>

                  <Link to={`/discussions/${discussion.id}`} className="block text-base font-semibold hover:text-primary transition-colors">
                    {discussion.title}
                  </Link>

                  <p className="text-sm text-muted-foreground line-clamp-2">{discussion.content}</p>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>by <Link to={`/users/${discussion.user.id}`} className="hover:text-primary">{discussion.user.name}</Link></span>
                    <span>{discussion.replyCount} replies</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
