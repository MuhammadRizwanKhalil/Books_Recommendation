import { useEffect, useState } from 'react';
import { Plus, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { editionsApi, type EditionFormat } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Work = {
  id: string;
  title: string;
  canonical_book_id: string;
  canonical_title: string;
  created_at: string;
};

const EDITION_FORMATS: { value: EditionFormat; label: string }[] = [
  { value: 'hardcover', label: 'Hardcover' },
  { value: 'paperback', label: 'Paperback' },
  { value: 'ebook', label: 'eBook' },
  { value: 'audiobook', label: 'Audiobook' },
  { value: 'large_print', label: 'Large Print' },
  { value: 'mass_market', label: 'Mass Market' },
];

export function AdminEditions() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);

  // Create work form
  const [newTitle, setNewTitle] = useState('');
  const [newCanonicalId, setNewCanonicalId] = useState('');
  const [creating, setCreating] = useState(false);

  // Assign book form
  const [assignBookId, setAssignBookId] = useState('');
  const [assignWorkId, setAssignWorkId] = useState('');
  const [assignFormat, setAssignFormat] = useState<EditionFormat | ''>('');
  const [assignLanguage, setAssignLanguage] = useState('en');
  const [assignPublisher, setAssignPublisher] = useState('');
  const [assignYear, setAssignYear] = useState('');
  const [assigning, setAssigning] = useState(false);

  async function loadWorks() {
    try {
      const data = await editionsApi.adminListWorks();
      setWorks(data.works);
    } catch {
      toast.error('Failed to load works');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadWorks(); }, []);

  async function handleCreateWork(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newCanonicalId.trim()) return;
    setCreating(true);
    try {
      await editionsApi.adminCreateWork({ title: newTitle.trim(), canonicalBookId: newCanonicalId.trim() });
      toast.success('Work created');
      setNewTitle('');
      setNewCanonicalId('');
      void loadWorks();
    } catch {
      toast.error('Failed to create work');
    } finally {
      setCreating(false);
    }
  }

  async function handleAssignBook(e: React.FormEvent) {
    e.preventDefault();
    if (!assignBookId.trim() || !assignWorkId.trim()) return;
    setAssigning(true);
    try {
      await editionsApi.adminAssignWork(assignBookId.trim(), {
        workId: assignWorkId.trim(),
        editionFormat: assignFormat || null,
        editionLanguage: assignLanguage.trim() || null,
        editionPublisher: assignPublisher.trim() || null,
        editionYear: assignYear ? Number(assignYear) : null,
      });
      toast.success('Book assigned to work');
      setAssignBookId('');
      setAssignWorkId('');
      setAssignFormat('');
      setAssignLanguage('en');
      setAssignPublisher('');
      setAssignYear('');
    } catch {
      toast.error('Failed to assign book');
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="admin-editions-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="h-6 w-6" aria-hidden="true" />
          Editions / Works Manager
        </h1>
        <p className="text-muted-foreground mt-1">Group book editions under a single "work" entry.</p>
      </div>

      {/* Create Work */}
      <section className="border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Create New Work
        </h2>
        <form onSubmit={(e) => void handleCreateWork(e)} className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="work-title">Work Title</Label>
            <Input
              id="work-title"
              placeholder="e.g. Atomic Habits"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="canonical-book-id">Canonical Book ID</Label>
            <Input
              id="canonical-book-id"
              placeholder="Book UUID"
              value={newCanonicalId}
              onChange={(e) => setNewCanonicalId(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create Work'}
            </Button>
          </div>
        </form>
      </section>

      {/* Assign Book to Work */}
      <section className="border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">Assign Book to Work</h2>
        <form onSubmit={(e) => void handleAssignBook(e)} className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="assign-book-id">Book ID</Label>
            <Input
              id="assign-book-id"
              placeholder="Book UUID"
              value={assignBookId}
              onChange={(e) => setAssignBookId(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="assign-work-id">Work ID</Label>
            <Input
              id="assign-work-id"
              placeholder="Work UUID"
              value={assignWorkId}
              onChange={(e) => setAssignWorkId(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="assign-format">Edition Format</Label>
            <Select value={assignFormat} onValueChange={(v) => setAssignFormat(v as EditionFormat)}>
              <SelectTrigger id="assign-format">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {EDITION_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="assign-language">Language</Label>
            <Input
              id="assign-language"
              placeholder="en"
              value={assignLanguage}
              onChange={(e) => setAssignLanguage(e.target.value)}
              maxLength={10}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="assign-publisher">Publisher</Label>
            <Input
              id="assign-publisher"
              placeholder="Publisher name"
              value={assignPublisher}
              onChange={(e) => setAssignPublisher(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="assign-year">Year</Label>
            <Input
              id="assign-year"
              type="number"
              placeholder="2024"
              value={assignYear}
              onChange={(e) => setAssignYear(e.target.value)}
              min="1000"
              max="2100"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={assigning}>
              {assigning ? 'Assigning…' : 'Assign Book'}
            </Button>
          </div>
        </form>
      </section>

      {/* Works list */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">All Works ({works.length})</h2>
        {works.length === 0 ? (
          <p className="text-muted-foreground">No works created yet.</p>
        ) : (
          <div className="divide-y border rounded-xl overflow-hidden">
            {works.map((work) => (
              <div key={work.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{work.title}</p>
                  <p className="text-sm text-muted-foreground truncate">Canonical: {work.canonical_title}</p>
                </div>
                <code className="text-xs text-muted-foreground font-mono shrink-0">{work.id}</code>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
