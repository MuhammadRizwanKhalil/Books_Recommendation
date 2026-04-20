import { useEffect, useMemo, useState } from 'react';
import { Heart, Lightbulb, MessageCircleMore, Send } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, promptsApi, type PromptResponseItemResponse, type BookPromptResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CommunityPromptsProps {
  bookId: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function CommunityPrompts({ bookId }: CommunityPromptsProps) {
  const { isAuthenticated, isLoading, openAuthModal } = useAuth();
  const [prompts, setPrompts] = useState<BookPromptResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPrompt, setNewPrompt] = useState('');
  const [creatingPrompt, setCreatingPrompt] = useState(false);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [responsesMap, setResponsesMap] = useState<Record<string, PromptResponseItemResponse[]>>({});
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [loadingPromptId, setLoadingPromptId] = useState<string | null>(null);
  const [submittingPromptId, setSubmittingPromptId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    promptsApi.listByBook(bookId)
      .then((data) => {
        if (!alive) return;
        setPrompts(data.prompts || []);
      })
      .catch(() => {
        if (!alive) return;
        setPrompts([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [bookId]);

  const orderedPrompts = useMemo(
    () => [...prompts].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.responseCount - a.responseCount),
    [prompts],
  );

  const openPrompt = async (promptId: string) => {
    setActivePromptId(promptId);
    if (responsesMap[promptId]) return;

    setLoadingPromptId(promptId);
    try {
      const data = await promptsApi.getResponses(promptId);
      setResponsesMap((prev) => ({ ...prev, [promptId]: data.responses || [] }));
    } catch {
      toast.error('Failed to load prompt responses');
    } finally {
      setLoadingPromptId(null);
    }
  };

  const handleCreatePrompt = async () => {
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }
    if (!newPrompt.trim()) {
      toast.error('Prompt text is required');
      return;
    }

    setCreatingPrompt(true);
    try {
      const created = await promptsApi.create(bookId, { promptText: newPrompt.trim() });
      setPrompts((prev) => [...prev, created]);
      setNewPrompt('');
      toast.success('Prompt created');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create prompt';
      toast.error(message);
    } finally {
      setCreatingPrompt(false);
    }
  };

  const handleSubmitResponse = async (promptId: string) => {
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }

    const content = (responseDrafts[promptId] || '').trim();
    if (!content) {
      toast.error('Please add your answer first');
      return;
    }

    setSubmittingPromptId(promptId);
    try {
      const created = await promptsApi.respond(promptId, { content });
      setResponsesMap((prev) => ({ ...prev, [promptId]: [...(prev[promptId] || []), created] }));
      setPrompts((prev) => prev.map((item) => item.id === promptId
        ? { ...item, responseCount: item.responseCount + 1, userHasResponded: true }
        : item));
      setResponseDrafts((prev) => ({ ...prev, [promptId]: '' }));
      toast.success('Response submitted');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setPrompts((prev) => prev.map((item) => item.id === promptId ? { ...item, userHasResponded: true } : item));
      }
      const message = err instanceof ApiError ? err.message : 'Failed to submit response';
      toast.error(message);
    } finally {
      setSubmittingPromptId(null);
    }
  };

  const handleLike = async (responseId: string, promptId: string) => {
    try {
      const data = await promptsApi.likeResponse(responseId);
      setResponsesMap((prev) => ({
        ...prev,
        [promptId]: (prev[promptId] || []).map((item) => item.id === responseId ? { ...item, likeCount: data.likeCount } : item),
      }));
      toast.success(data.message || 'Marked as helpful');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to like response';
      toast.error(message);
    }
  };

  return (
    <section data-testid="community-prompts-section" className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Community Prompts</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a question for readers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            data-testid="new-prompt-input"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="Ask readers something fun or thoughtful"
            maxLength={500}
          />
          <div className="flex justify-end">
            <Button
              data-testid="new-prompt-submit"
              onClick={handleCreatePrompt}
              disabled={creatingPrompt}
              className="gap-2 bg-foreground text-background hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            >
              <Send className="h-4 w-4" />
              {creatingPrompt ? 'Posting...' : 'Add prompt'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Loading prompts...</div>
      ) : orderedPrompts.length === 0 ? (
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No community prompts yet. Start the first one.</div>
      ) : (
        <div className="space-y-3">
          {orderedPrompts.map((prompt) => {
            const isActive = activePromptId === prompt.id;
            const responses = responsesMap[prompt.id] || prompt.topResponses || [];
            return (
              <Card key={prompt.id} data-testid="community-prompt-card" className="w-full">
                <CardContent className="pt-5 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2 min-w-0">
                      <p className="font-medium leading-6">{prompt.promptText}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">{prompt.responseCount} responses</Badge>
                      </div>
                    </div>
                    <Button data-testid="view-prompt-responses" variant="outline" onClick={() => openPrompt(prompt.id)}>
                      {isActive ? 'Viewing answers' : 'Answer'}
                    </Button>
                  </div>

                  {responses.length > 0 && !isActive && (
                    <div className="space-y-2">
                      {responses.slice(0, 1).map((response) => (
                        <div key={response.id} className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                          “{response.content}”
                        </div>
                      ))}
                    </div>
                  )}

                  {isActive && (
                    <div data-testid="prompt-responses-panel" className="space-y-3 rounded-lg border bg-muted/20 p-3">
                      {loadingPromptId === prompt.id ? (
                        <div className="text-sm text-muted-foreground">Loading responses...</div>
                      ) : responses.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No answers yet.</div>
                      ) : (
                        responses.map((response) => (
                          <div key={response.id} className="rounded-lg border bg-background p-3">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={response.user.avatarUrl || undefined} alt={response.user.name} />
                                <AvatarFallback>{initials(response.user.name)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="text-sm font-medium">{response.user.name}</div>
                                <p className="text-sm text-muted-foreground">{response.content}</p>
                                <Button
                                  data-testid="prompt-response-like-button"
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => handleLike(response.id, prompt.id)}
                                >
                                  <Heart className="h-4 w-4" />
                                  {response.likeCount}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}

                      {isAuthenticated && !isLoading && !prompt.userHasResponded && (
                        <div data-testid="prompt-response-form" className="space-y-3">
                          <Textarea
                            data-testid="prompt-response-input"
                            value={responseDrafts[prompt.id] || ''}
                            onChange={(e) => setResponseDrafts((prev) => ({ ...prev, [prompt.id]: e.target.value }))}
                            rows={3}
                            placeholder="Share your answer"
                          />
                          <div className="flex justify-end">
                            <Button
                              data-testid="prompt-response-submit"
                              type="button"
                              onClick={() => handleSubmitResponse(prompt.id)}
                              disabled={submittingPromptId === prompt.id}
                              className="gap-2 bg-foreground text-background hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                            >
                              <MessageCircleMore className="h-4 w-4" />
                              {submittingPromptId === prompt.id ? 'Submitting...' : 'Submit answer'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
