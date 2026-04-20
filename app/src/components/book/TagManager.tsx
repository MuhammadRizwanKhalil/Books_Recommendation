import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Tag as TagIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { type UserTagResponse, tagsApi } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TagManagerProps {
  bookId: string;
}

const DEFAULT_TAG_COLOR = '#4f46e5';

function pillStyle(color?: string | null) {
  if (!color) return undefined;
  return {
    borderColor: `${color}66`,
    backgroundColor: `${color}22`,
  };
}

export function TagManager({ bookId }: TagManagerProps) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [bookTags, setBookTags] = useState<UserTagResponse[]>([]);
  const [allTags, setAllTags] = useState<UserTagResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_TAG_COLOR);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setBookTags([]);
      setAllTags([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [bookRes, tagsRes] = await Promise.all([
        tagsApi.listForBook(bookId),
        tagsApi.list(),
      ]);
      setBookTags(bookRes.tags || []);
      setAllTags(tagsRes.tags || []);
    } catch {
      setBookTags([]);
      setAllTags([]);
    } finally {
      setLoading(false);
    }
  }, [bookId, isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const availableTags = useMemo(() => {
    const selected = new Set(bookTags.map((tag) => tag.id));
    return allTags.filter((tag) => !selected.has(tag.id));
  }, [allTags, bookTags]);

  async function addExistingTag(tagId: string) {
    try {
      setUpdating(true);
      const result = await tagsApi.addToBook(bookId, [tagId]);
      setBookTags(result.tags || []);
      const refreshed = await tagsApi.list();
      setAllTags(refreshed.tags || []);
      toast.success('Tag added to book');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add tag');
    } finally {
      setUpdating(false);
    }
  }

  async function removeTag(tagId: string) {
    try {
      setUpdating(true);
      const result = await tagsApi.removeFromBook(bookId, tagId);
      setBookTags(result.tags || []);
      const refreshed = await tagsApi.list();
      setAllTags(refreshed.tags || []);
      toast.success('Tag removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove tag');
    } finally {
      setUpdating(false);
    }
  }

  async function createAndAttachTag() {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error('Tag name is required');
      return;
    }

    try {
      setCreating(true);
      const created = await tagsApi.create({ name: trimmed, color: newColor || null });
      const result = await tagsApi.addToBook(bookId, [created.tag.id]);
      setBookTags(result.tags || []);
      const refreshed = await tagsApi.list();
      setAllTags(refreshed.tags || []);
      setNewName('');
      setNewColor(DEFAULT_TAG_COLOR);
      setOpen(false);
      toast.success('Tag created');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create tag');
    } finally {
      setCreating(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-dashed p-3" data-testid="tag-manager-guest">
        <p className="text-xs text-muted-foreground">Sign in to add private tags to this book.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => openAuthModal('signin')}>
          Sign in
        </Button>
      </div>
    );
  }

  if (loading) {
    return <div className="h-12 rounded-xl bg-muted animate-pulse" data-testid="tag-manager-loading" />;
  }

  return (
    <div className="space-y-3" data-testid="tag-manager">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <TagIcon className="h-4 w-4" />
          My Tags
        </h3>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              data-testid="tag-add-button"
              disabled={updating}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80" data-testid="tag-picker">
            <div className="space-y-3">
              <p className="text-sm font-medium">Add existing tag</p>
              {availableTags.length === 0 ? (
                <p className="text-xs text-muted-foreground">No unused tags. Create one below.</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
                  {availableTags.map((tag) => (
                    <Button
                      key={tag.id}
                      variant="outline"
                      size="sm"
                      data-testid={`tag-option-${tag.id}`}
                      onClick={() => void addExistingTag(tag.id)}
                      disabled={updating || creating}
                      style={pillStyle(tag.color)}
                    >
                      {tag.name}
                    </Button>
                  ))}
                </div>
              )}

              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium">Create new tag</p>
                <Input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. comfort reads"
                  maxLength={100}
                  data-testid="tag-create-input"
                />
                <div className="flex items-center gap-2">
                  <label htmlFor="tag-color" className="text-xs text-muted-foreground">Color</label>
                  <input
                    id="tag-color"
                    type="color"
                    value={newColor}
                    onChange={(event) => setNewColor(event.target.value)}
                    className="h-8 w-10 rounded border bg-transparent p-1"
                    data-testid="tag-color-input"
                  />
                  <Button
                    size="sm"
                    className="ml-auto"
                    onClick={() => void createAndAttachTag()}
                    disabled={creating || updating || newName.trim().length === 0}
                    data-testid="tag-create-button"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {bookTags.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="tag-empty">No personal tags yet for this book.</p>
      ) : (
        <div className="flex flex-wrap gap-2" data-testid="tag-pills">
          {bookTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="gap-1 py-1 pl-2 pr-1"
              style={pillStyle(tag.color)}
              data-testid={`tag-pill-${tag.id}`}
            >
              <span>{tag.name}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/15"
                aria-label={`Remove tag ${tag.name}`}
                onClick={() => void removeTag(tag.id)}
                disabled={updating}
                data-testid={`tag-remove-${tag.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
