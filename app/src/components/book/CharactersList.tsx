import { useEffect, useMemo, useState } from 'react';
import { Users, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { charactersApi, ApiError, type BookCharacterResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CharactersListProps {
  bookId: string;
}

const INITIAL_VISIBLE_COUNT = 8;

const roleClasses: Record<string, string> = {
  protagonist: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  antagonist: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  supporting: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  minor: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300',
};

function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function CharactersList({ bookId }: CharactersListProps) {
  const { isAuthenticated } = useAuth();
  const [characters, setCharacters] = useState<BookCharacterResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', role: 'supporting' });

  const visibleCharacters = useMemo(
    () => (expanded ? characters : characters.slice(0, INITIAL_VISIBLE_COUNT)),
    [characters, expanded],
  );

  async function loadCharacters() {
    try {
      setLoading(true);
      const response = await charactersApi.list(bookId);
      setCharacters(response.characters || []);
    } catch {
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCharacters();
  }, [bookId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAuthenticated) {
      toast.error('Please sign in to suggest a character.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await charactersApi.submit(bookId, form);
      setCharacters((prev) => {
        const next = [response.character, ...prev];
        return next.sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
      });
      setForm({ name: '', description: '', role: 'supporting' });
      setFormOpen(false);
      setExpanded(true);
      toast.success(response.message || 'Character submitted');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to submit character';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="space-y-3" data-testid="characters-section">
        <div className="h-6 w-40 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (characters.length === 0 && !isAuthenticated) {
    return null;
  }

  return (
    <section className="space-y-4" data-testid="characters-section">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Characters
          </h2>
          <p className="text-sm text-muted-foreground">
            Meet the cast behind this story.
          </p>
        </div>

        {characters.length > INITIAL_VISIBLE_COUNT && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="characters-show-all"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Show fewer' : `Show all ${characters.length} characters`}
          </Button>
        )}
      </div>

      {characters.length > 0 ? (
        <div
          data-testid="characters-grid"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
        >
          {visibleCharacters.map((character) => (
            <article
              key={character.id}
              data-testid="character-card"
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold leading-snug" data-testid={`character-card-${character.id}`}>
                  {character.name}
                </h3>
                <div className="flex flex-wrap gap-1 justify-end">
                  <Badge variant="outline" className={roleClasses[character.role] || ''}>
                    {formatRole(character.role)}
                  </Badge>
                  {!character.isApproved && (
                    <Badge variant="secondary">Pending approval</Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {character.description || 'No description has been added yet.'}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No characters have been added yet. Be the first to suggest one.
        </div>
      )}

      <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Suggest a character
            </h3>
            <p className="text-sm text-muted-foreground">
              Community submissions are reviewed before appearing for everyone.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            data-testid="submit-character-button"
            onClick={() => setFormOpen((value) => !value)}
          >
            {formOpen ? 'Close form' : 'Add a character'}
          </Button>
        </div>

        {!isAuthenticated ? (
          <p className="text-sm text-muted-foreground">Sign in to suggest a character for this book.</p>
        ) : formOpen ? (
          <form className="grid gap-3" data-testid="character-submit-form" onSubmit={handleSubmit}>
            <label className="grid gap-1 text-sm font-medium">
              Character name
              <input
                aria-label="Character name"
                className="rounded-md border bg-background px-3 py-2"
                maxLength={255}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Role
              <select
                aria-label="Role"
                className="rounded-md border bg-background px-3 py-2"
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              >
                <option value="protagonist">Protagonist</option>
                <option value="antagonist">Antagonist</option>
                <option value="supporting">Supporting</option>
                <option value="minor">Minor</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Description
              <textarea
                aria-label="Description"
                className="min-h-24 rounded-md border bg-background px-3 py-2"
                maxLength={1000}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Who are they and why do they matter?"
              />
            </label>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit character'}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
