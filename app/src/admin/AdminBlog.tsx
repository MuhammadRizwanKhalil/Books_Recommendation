import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, ChevronLeft, ChevronRight, FileText, Eye,
  Search, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { blogApi } from '@/api/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function AdminBlog() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const limit = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await blogApi.list(page, limit);
      setPosts(res.posts);
      setTotal(res.pagination.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);
  const totalPages = Math.ceil(total / limit);

  async function handleDelete(id: string) {
    try {
      await blogApi.delete(id);
      toast.success('Post deleted');
      setDeleteConfirm(null);
      await load();
    } catch (err: any) { toast.error(err.message || 'Failed'); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Blog Posts</h1>
        <Button onClick={() => navigate('/admin/blog/new')}>
          <Plus className="h-4 w-4 mr-2" /> New Post
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" /> {total} Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse h-16 bg-muted rounded" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No blog posts yet</p>
              <Button className="mt-4" onClick={() => navigate('/admin/blog/new')}>
                <Plus className="h-4 w-4 mr-2" /> Create Your First Post
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4">Title</th>
                    <th className="pb-3 pr-4 hidden md:table-cell">Status</th>
                    <th className="pb-3 pr-4 hidden lg:table-cell">Category</th>
                    <th className="pb-3 pr-4 hidden lg:table-cell">SEO</th>
                    <th className="pb-3 pr-4 hidden lg:table-cell">Published</th>
                    <th className="pb-3 pr-4 hidden xl:table-cell">Source</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3 pr-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium line-clamp-1">{post.title}</p>
                            <Badge variant={post.status === 'PUBLISHED' ? 'default' : post.status === 'SCHEDULED' ? 'outline' : 'secondary'} className="md:hidden shrink-0 text-[10px]">
                              {post.status}
                            </Badge>
                          </div>
                          {post.excerpt && <p className="text-xs text-muted-foreground line-clamp-1">{post.excerpt}</p>}
                        </div>
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell">
                        <Badge variant={post.status === 'PUBLISHED' ? 'default' : post.status === 'SCHEDULED' ? 'outline' : 'secondary'}>
                          {post.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 hidden lg:table-cell text-muted-foreground text-xs">
                        {post.category || '—'}
                      </td>
                      <td className="py-3 pr-4 hidden lg:table-cell">
                        {post.metaTitle && post.metaDescription ? (
                          <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                            <Search className="h-3 w-3 mr-1" /> OK
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-xs">
                            Missing
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 hidden lg:table-cell text-muted-foreground">
                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 pr-4 hidden xl:table-cell">
                        <Badge variant="outline" className="text-xs">{post.generatedBy || 'manual'}</Badge>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {post.status === 'PUBLISHED' && (
                            <Button variant="ghost" size="icon" asChild title="View on site">
                              <a
                                href={`/blog/${post.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`View ${post.title} on site`}
                                title={`View ${post.title} on site`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => navigate(`/admin/blog/edit/${post.slug}`)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            title="Delete"
                            onClick={() => setDeleteConfirm(post.id)}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirm */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Post</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
