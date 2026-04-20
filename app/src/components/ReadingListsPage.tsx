import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BookOpen, Plus, Trash2, Globe, Lock, ArrowLeft,
  MoreHorizontal, Pencil, Share2, Star, Calendar, Sparkles, ThumbsUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  readingListsApi,
  type ReadingListResponse,
  type ReadingListDetailResponse,
} from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { useSEO } from '@/hooks/useSEO';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════════
// My Reading Lists — overview page
// ═══════════════════════════════════════════════════════════════════════════════

export function ReadingListsPage() {
  const { user } = useAuth();
  const [lists, setLists] = useState<ReadingListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [newIsCommunity, setNewIsCommunity] = useState(false);
  const [creating, setCreating] = useState(false);

  useSEO({
    title: 'My Reading Lists | The Book Times',
    description: 'Create and manage your personal book reading lists and share them with the community.',
  });

  const getListHref = (list: ReadingListResponse) => list.isCommunity ? `/lists/${list.id}` : `/lists/mine/${list.id}`;

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      const data = await readingListsApi.list();
      setLists(data.lists);
    } catch {
      toast.error('Failed to fetch reading lists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchLists();
    else setLoading(false);
  }, [user, fetchLists]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const list = await readingListsApi.create({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        isPublic: newIsCommunity ? true : newIsPublic,
        isCommunity: newIsCommunity,
      });
      setLists(prev => [list, ...prev]);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewIsPublic(true);
      setNewIsCommunity(false);
      toast.success(list.isCommunity ? 'Community list created!' : 'Reading list created!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create reading list');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await readingListsApi.delete(id);
      setLists(prev => prev.filter(l => l.id !== id));
      toast.success('Reading list deleted');
    } catch {
      toast.error('Failed to delete reading list');
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
            <div className="relative p-5 rounded-full bg-primary/10">
              <BookOpen className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-serif mb-3">Reading Lists</h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
            Create curated collections of books � track what you want to read, share recommendations with friends, or organize by mood and genre.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {['Summer 2026 Reads', 'Book Club Picks', 'Sci-Fi Essentials', 'Must-Read Non-Fiction'].map((name) => (
              <span key={name} className="px-4 py-2 rounded-full bg-muted/60 border border-border/50 text-sm text-muted-foreground">
                {name}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Sign in to start building your reading lists.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold font-serif">My Reading Lists</h1>
              <p className="text-muted-foreground mt-1">Organize your books into collections</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link to="/lists/discover">
                  <Sparkles className="h-4 w-4 mr-2" /> Discover Community Lists
                </Link>
              </Button>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" /> New List
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground mb-4">No reading lists yet</p>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create your first list
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lists.map((list, index) => (
                <motion.div
                  key={list.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <Link to={getListHref(list)} className="flex-1 group">
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">
                            {list.name}
                          </CardTitle>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={getListHref(list)}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(list.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {list.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{list.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <Badge variant="secondary" className="gap-1">
                          <BookOpen className="h-3 w-3" />
                          {list.bookCount} {list.bookCount === 1 ? 'book' : 'books'}
                        </Badge>
                        <Badge variant={list.isPublic ? 'outline' : 'secondary'} className="gap-1">
                          {list.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          {list.isPublic ? 'Public' : 'Private'}
                        </Badge>
                        {list.isCommunity && (
                          <Badge variant="outline" className="gap-1">
                            <Sparkles className="h-3 w-3" /> Community
                          </Badge>
                        )}
                        {list.isCommunity && (
                          <Badge variant="outline" className="gap-1">
                            <ThumbsUp className="h-3 w-3" /> {list.voteCount || 0} votes
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Reading List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label htmlFor="newListName" className="text-sm font-medium mb-1 block">Name</label>
              <Input
                id="newListName"
                placeholder="e.g., Summer 2025 Reads"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="newListDesc" className="text-sm font-medium mb-1 block">Description (optional)</label>
              <Textarea
                id="newListDesc"
                placeholder="What's this list about?"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={newIsCommunity ? true : newIsPublic}
                onChange={e => setNewIsPublic(e.target.checked)}
                className="rounded"
                disabled={newIsCommunity}
              />
              <label htmlFor="isPublic" className="text-sm">
                Make this list public (anyone with the link can view it)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isCommunity"
                checked={newIsCommunity}
                onChange={e => {
                  setNewIsCommunity(e.target.checked);
                  if (e.target.checked) setNewIsPublic(true);
                }}
                className="rounded"
              />
              <label htmlFor="isCommunity" className="text-sm">
                Community voteable list (public ranking others can vote on)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? 'Creating...' : 'Create List'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Reading List Detail — view & manage one list
// ═══════════════════════════════════════════════════════════════════════════════

export function ReadingListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [list, setList] = useState<ReadingListDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useSEO({
    title: list ? `${list.name} — Reading List | The Book Times` : 'Reading List | The Book Times',
    description: list?.description || 'A curated reading list on The Book Times.',
  });

  const fetchList = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await readingListsApi.get(id);
      setList(data);
      setEditName(data.name);
      setEditDesc(data.description || '');
    } catch {
      setError('Reading list not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleUpdate = async () => {
    if (!list || !editName.trim()) return;
    try {
      await readingListsApi.update(list.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setList(prev => prev ? { ...prev, name: editName.trim(), description: editDesc.trim() } : prev);
      setEditing(false);
      toast.success('List updated');
    } catch {
      toast.error('Failed to update list');
    }
  };

  const handleRemoveBook = async (bookId: string) => {
    if (!list) return;
    try {
      await readingListsApi.removeBook(list.id, bookId);
      setList(prev => prev ? {
        ...prev,
        items: prev.items.filter(i => i.bookId !== bookId),
        bookCount: prev.bookCount - 1,
      } : prev);
      toast.success('Book removed');
    } catch {
      toast.error('Failed to remove book');
    }
  };

  const handleCopyShareLink = () => {
    if (!list) return;
    const url = `${window.location.origin}/lists/public/${list.userId}/${list.slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Share link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 pb-12">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">List Not Found</h1>
        <p className="text-muted-foreground mb-6">{error || 'This reading list does not exist.'}</p>
        <Button asChild>
          <Link to="/lists"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Lists</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          {/* Back */}
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
            <Link to="/lists"><ArrowLeft className="h-4 w-4 mr-1" /> My Lists</Link>
          </Button>

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex-1">
              {editing ? (
                <div className="space-y-3 max-w-lg">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="text-2xl font-bold"
                  />
                  <Textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={2}
                    placeholder="Description..."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdate}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold font-serif">{list.name}</h1>
                  {list.description && (
                    <p className="text-muted-foreground mt-1">{list.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-3">
                    <Badge variant="secondary" className="gap-1">
                      <BookOpen className="h-3 w-3" />
                      {list.bookCount} {list.bookCount === 1 ? 'book' : 'books'}
                    </Badge>
                    <Badge variant={list.isPublic ? 'outline' : 'secondary'} className="gap-1">
                      {list.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {list.isPublic ? 'Public' : 'Private'}
                    </Badge>
                  </div>
                </>
              )}
            </div>
            {!editing && (
              <div className="flex gap-2">
                {list.isPublic && (
                  <Button variant="outline" size="sm" onClick={handleCopyShareLink}>
                    <Share2 className="h-4 w-4 mr-1" /> Share
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              </div>
            )}
          </div>

          {/* Items */}
          {list.items.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground mb-2">This list is empty</p>
              <p className="text-sm text-muted-foreground">
                Browse books and add them to this list from the book detail page.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {list.items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5 group">
                    <div className="flex gap-4 p-4">
                      <Link to={`/book/${item.slug}`} className="w-20 shrink-0">
                        <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted shadow-sm">
                          {item.coverImage ? (
                            <img
                              src={item.coverImage}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/20">
                              <BookOpen className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                      </Link>
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <Link to={`/book/${item.slug}`}>
                            <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                              {item.title}
                            </h3>
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.author}</p>
                          {item.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {item.categories.slice(0, 2).map(c => (
                                <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0 rounded-full">{c}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            {item.googleRating && (
                              <>
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs font-medium">{item.googleRating}</span>
                              </>
                            )}
                            {item.publishedDate && (
                              <span className="text-xs text-muted-foreground ml-1 flex items-center gap-0.5">
                                <Calendar className="h-3 w-3" />
                                {item.publishedDate.substring(0, 4)}
                              </span>
                            )}
                          </div>
                          {user && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveBook(item.bookId)}
                              title="Remove from list"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    {item.notes && (
                      <div className="px-4 pb-3 pt-0">
                        <p className="text-xs text-muted-foreground italic border-t pt-2">
                          {item.notes}
                        </p>
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public Reading List — shared view (no auth needed)
// ═══════════════════════════════════════════════════════════════════════════════

export function PublicReadingListPage() {
  const { userId, slug } = useParams<{ userId: string; slug: string }>();
  const [list, setList] = useState<ReadingListDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSEO({
    title: list ? `${list.name} by ${list.userName} — Reading List | The Book Times` : 'Reading List | The Book Times',
    description: list?.description || 'A curated reading list on The Book Times.',
    ...(list && {
      ogType: 'website',
      canonical: `/lists/public/${userId}/${slug}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: list.name,
        description: list.description,
        numberOfItems: list.bookCount,
        itemListElement: list.items.map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Book',
            name: item.title,
            author: { '@type': 'Person', name: item.author },
            url: `${window.location.origin}/book/${item.slug}`,
          },
        })),
      },
    }),
  });

  useEffect(() => {
    if (!userId || !slug) return;
    setLoading(true);
    readingListsApi.getPublic(userId, slug)
      .then(setList)
      .catch(() => setError('Reading list not found'))
      .finally(() => setLoading(false));
  }, [userId, slug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 pb-12">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">List Not Found</h1>
        <p className="text-muted-foreground mb-6">{error || 'This reading list does not exist or is private.'}</p>
        <Button asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-b from-primary/5 via-primary/3 to-background border-b">
        <div className="container mx-auto px-4 pt-20 pb-10 md:pt-24">
          <div className="max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Globe className="h-3 w-3" /> Public Reading List
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold font-serif">{list.name}</h1>
            {list.userName && (
              <p className="text-muted-foreground mt-1">by {list.userName}</p>
            )}
            {list.description && (
              <p className="text-muted-foreground mt-3 max-w-2xl">{list.description}</p>
            )}
            <div className="flex items-center gap-3 mt-4">
              <Badge variant="secondary" className="gap-1">
                <BookOpen className="h-3 w-3" />
                {list.bookCount} {list.bookCount === 1 ? 'book' : 'books'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        <div className="max-w-4xl mx-auto">
          {list.items.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">
              This reading list is empty.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {list.items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Link to={`/book/${item.slug}`} className="group block">
                    <Card className="overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5">
                      <div className="flex gap-4 p-4">
                        <div className="w-20 shrink-0">
                          <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted shadow-sm">
                            {item.coverImage ? (
                              <img
                                src={item.coverImage}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/20">
                                <BookOpen className="h-6 w-6 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                              {item.title}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.author}</p>
                          </div>
                          <div className="flex items-center gap-1 mt-2">
                            {item.googleRating && (
                              <>
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs font-medium">{item.googleRating}</span>
                              </>
                            )}
                            {item.publishedDate && (
                              <span className="text-xs text-muted-foreground ml-1">
                                {item.publishedDate.substring(0, 4)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReadingListsPage;
