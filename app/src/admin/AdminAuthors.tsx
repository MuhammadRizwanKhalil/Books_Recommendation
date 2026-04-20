import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Users, Search, Globe, Star, BookOpen, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { authorsApi, type AuthorResponse, type AuthorClaimResponse } from '@/api/client';
import { toast } from 'sonner';

const emptyForm = {
  name: '',
  bio: '',
  imageUrl: '',
  websiteUrl: '',
};

export function AdminAuthors() {
  const [authors, setAuthors] = useState<AuthorResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editAuthor, setEditAuthor] = useState<AuthorResponse | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [claims, setClaims] = useState<AuthorClaimResponse[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setClaimsLoading(true);
    try {
      const [res, claimsRes] = await Promise.all([
        authorsApi.list(search || undefined),
        authorsApi.adminListClaims('pending'),
      ]);
      setAuthors(res);
      setClaims(claimsRes.claims);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load authors');
    } finally {
      setLoading(false);
      setClaimsLoading(false);
    }
  }, [search]);

  async function handleClaimDecision(id: string, status: 'approved' | 'rejected') {
    try {
      await authorsApi.adminUpdateClaim(id, status);
      toast.success(status === 'approved' ? 'Claim approved' : 'Claim rejected');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update claim');
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  function openCreate() {
    setEditAuthor(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(author: AuthorResponse) {
    setEditAuthor(author);
    setForm({
      name: author.name || '',
      bio: author.bio || '',
      imageUrl: author.imageUrl || '',
      websiteUrl: author.websiteUrl || '',
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Author name is required');
      return;
    }
    setSaving(true);
    try {
      if (editAuthor) {
        await authorsApi.update(editAuthor.id, form);
        toast.success('Author updated');
      } else {
        await authorsApi.create(form);
        toast.success('Author created');
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save author');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await authorsApi.delete(id);
      toast.success('Author deleted');
      setDeleteConfirm(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete author');
    }
  }

  const totalBooks = authors.reduce((sum, a) => sum + (a.bookCount || 0), 0);
  const avgRating = authors.length > 0
    ? (authors.reduce((sum, a) => sum + (a.avgRating || 0), 0) / authors.filter(a => a.avgRating).length).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Authors</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage book authors, bios, and profiles</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Author
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{authors.length}</p>
                <p className="text-xs text-muted-foreground">Total Authors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <BookOpen className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalBooks}</p>
                <p className="text-xs text-muted-foreground">Total Books</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgRating}</p>
                <p className="text-xs text-muted-foreground">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Author Claims</CardTitle>
        </CardHeader>
        <CardContent>
          {claimsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : claims.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending claims.</p>
          ) : (
            <div className="space-y-2">
              {claims.map((claim) => (
                <div key={claim.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" data-testid={`admin-author-claim-${claim.id}`}>
                  <div>
                    <p className="text-sm font-medium">{claim.authorName || claim.authorId}</p>
                    <p className="text-xs text-muted-foreground">Claimant: {claim.claimantName || claim.userId}</p>
                    <p className="text-xs text-muted-foreground">Method: {claim.verificationMethod}</p>
                    {claim.verificationProof && (
                      <p className="text-xs text-muted-foreground break-all">Proof: {claim.verificationProof}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleClaimDecision(claim.id, 'rejected')}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => handleClaimDecision(claim.id, 'approved')} data-testid={`admin-author-claim-approve-${claim.id}`}>
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search + Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> Author Directory
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search authors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse h-16 bg-muted rounded" />
              ))}
            </div>
          ) : authors.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {search ? 'No authors match your search.' : 'No authors yet. Add your first author!'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4">Author</th>
                    <th className="pb-3 pr-4 hidden md:table-cell">Slug</th>
                    <th className="pb-3 pr-4 text-center">Books</th>
                    <th className="pb-3 pr-4 text-center hidden sm:table-cell">Rating</th>
                    <th className="pb-3 pr-4 hidden lg:table-cell">Website</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {authors.map((author) => (
                    <tr key={author.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          {author.imageUrl ? (
                            <img
                              src={author.imageUrl}
                              alt={author.name}
                              className="w-10 h-10 rounded-full object-cover ring-2 ring-border"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border">
                              <span className="text-sm font-bold text-primary">
                                {author.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate">{author.name}</p>
                            {author.bio && (
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{author.bio}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell">
                        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{author.slug}</code>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <Badge variant="secondary">{author.bookCount || 0}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-center hidden sm:table-cell">
                        {author.avgRating ? (
                          <span className="flex items-center justify-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs">{author.avgRating}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 hidden lg:table-cell">
                        {author.websiteUrl ? (
                          <a
                            href={author.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 max-w-[150px] truncate"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            {new URL(author.websiteUrl).hostname}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(`/author/${author.slug}`, '_blank')}
                            title="View public page"
                          >
                            <Globe className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(author)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteConfirm(author.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editAuthor ? 'Edit Author' : 'Add Author'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover ring-2 ring-border" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border">
                  <span className="text-sm font-bold text-primary">
                    {form.name ? form.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??'}
                  </span>
                </div>
              )}
              <div>
                <p className="font-medium text-sm">{form.name || 'Author Name'}</p>
                <p className="text-xs text-muted-foreground">{editAuthor ? `Slug: ${editAuthor.slug}` : 'New author'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. J.K. Rowling"
              />
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://example.com/photo.jpg"
              />
            </div>
            <div className="space-y-2">
              <Label>Website URL</Label>
              <Input
                value={form.websiteUrl}
                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                placeholder="https://author-website.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Biography</Label>
              <Textarea
                rows={4}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="A brief biography of the author..."
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : (editAuthor ? 'Update Author' : 'Create Author')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Author</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            This will remove the author and unlink all their books. The books will not be deleted. Continue?
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Delete Author
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminAuthors;
