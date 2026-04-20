import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Loader2, Lock, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { readingListsApi, type ReadingListForBookResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface AddToListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  bookTitle: string;
}

export function AddToListModal({ open, onOpenChange, bookId, bookTitle }: AddToListModalProps) {
  const { isAuthenticated, isAdmin, openAuthModal } = useAuth();
  const [lists, setLists] = useState<ReadingListForBookResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingListId, setSavingListId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [limitError, setLimitError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (!isAuthenticated) return;

    let active = true;
    setLoading(true);
    setLimitError('');

    readingListsApi.forBook(bookId)
      .then((response) => {
        if (!active) return;
        setLists(response);
      })
      .catch((err: any) => {
        if (!active) return;
        toast.error(err?.message || 'Failed to load your lists');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, isAuthenticated, bookId]);

  const atFreeTierLimit = useMemo(
    () => !isAdmin && lists.length >= 3,
    [isAdmin, lists.length],
  );

  const handleToggle = async (list: ReadingListForBookResponse) => {
    setSavingListId(list.id);
    try {
      if (list.containsBook) {
        await readingListsApi.removeBook(list.id, bookId);
        setLists((prev) => prev.map((item) => item.id === list.id
          ? { ...item, containsBook: false, itemCount: Math.max(0, item.itemCount - 1) }
          : item));
        toast.success(`Removed from ${list.name}`);
      } else {
        await readingListsApi.addBook(list.id, bookId);
        setLists((prev) => prev.map((item) => item.id === list.id
          ? { ...item, containsBook: true, itemCount: item.itemCount + 1 }
          : item));
        toast.success(`Added to ${list.name}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update list');
    } finally {
      setSavingListId(null);
    }
  };

  const handleCreate = async () => {
    const trimmedName = newListName.trim();
    if (!trimmedName) return;

    setCreating(true);
    setLimitError('');
    try {
      const created = await readingListsApi.create({
        name: trimmedName,
        isPublic: false,
      });
      await readingListsApi.addBook(created.id, bookId);

      setLists((prev) => [
        {
          id: created.id,
          name: created.name,
          slug: created.slug,
          containsBook: true,
          itemCount: created.bookCount > 0 ? created.bookCount : 1,
        },
        ...prev,
      ]);

      setNewListName('');
      setShowCreateForm(false);
      toast.success(`Added to ${created.name}`);
    } catch (err: any) {
      const message = err?.message || 'Failed to create list';
      if (err?.status === 403) {
        setLimitError(message);
      }
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-lg fixed bottom-0 top-auto left-0 right-0 translate-x-0 translate-y-0 sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2"
        data-testid="add-to-list-modal"
      >
        <DialogHeader>
          <DialogTitle>Add to List</DialogTitle>
          <DialogDescription>
            Save {bookTitle} to one or more custom reading lists.
          </DialogDescription>
        </DialogHeader>

        {!isAuthenticated ? (
          <div className="space-y-4 rounded-lg border border-dashed p-4 text-center" data-testid="add-to-list-signin-prompt">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Sign in to manage your lists</p>
              <p className="text-sm text-muted-foreground">Create custom shelves and save books instantly.</p>
            </div>
            <Button onClick={() => openAuthModal('signin')}>Sign in</Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your lists…
          </div>
        ) : (
          <div className="space-y-4">
            {lists.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center" data-testid="add-to-list-empty-state">
                <p className="font-medium">No lists yet — create your first list</p>
                <p className="mt-1 text-sm text-muted-foreground">Start a private shelf or a public collection.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lists.map((list) => (
                  <label
                    key={list.id}
                    htmlFor={`list-checkbox-${list.id}`}
                    className="flex cursor-pointer items-center justify-between rounded-lg border p-3 hover:bg-muted/40"
                    data-testid={`list-checkbox-row-${list.id}`}
                  >
                    <div className="min-w-0 pr-3">
                      <p className="truncate text-sm font-medium">{list.name}</p>
                      <p className="text-xs text-muted-foreground">{list.itemCount} {list.itemCount === 1 ? 'book' : 'books'}</p>
                    </div>
                    <Checkbox
                      id={`list-checkbox-${list.id}`}
                      data-testid={`list-checkbox-${list.id}`}
                      checked={list.containsBook}
                      disabled={savingListId === list.id}
                      aria-label={`Toggle ${bookTitle} in ${list.name}`}
                      onCheckedChange={() => handleToggle(list)}
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Create New List</p>
                {!showCreateForm && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowCreateForm(true)} data-testid="show-create-list-form">
                    <Plus className="mr-1 h-4 w-4" /> New
                  </Button>
                )}
              </div>

              {(limitError || atFreeTierLimit) && (
                <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="upgrade-prompt">
                  <div className="flex items-start gap-2">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Upgrade prompt</p>
                      <p>{limitError || 'Free tier allows up to 3 custom lists. Upgrade to create more.'}</p>
                      <Link to="/pricing" className="mt-1 inline-flex items-center gap-1 font-medium underline">
                        <Sparkles className="h-3.5 w-3.5" /> View plans
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {showCreateForm ? (
                <div className="space-y-2">
                  <Input
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g. Summer Reads 2026"
                    aria-label="Create new list name"
                    data-testid="create-list-name-input"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleCreate}
                      disabled={!newListName.trim() || creating || atFreeTierLimit}
                      data-testid="create-list-submit"
                    >
                      {creating ? 'Creating…' : 'Create & add'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowCreateForm(false)}>
                      Cancel
                    </Button>
                  </div>
                  {atFreeTierLimit && !limitError && (
                    <p className="text-xs text-muted-foreground">Free tier limit reached: 3 lists maximum.</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Create a new list and add this book instantly.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
