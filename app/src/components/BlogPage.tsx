import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, Calendar, Clock, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { blogApi } from '@/api/client';
import { formatDate, calculateReadingTime, truncateText } from '@/lib/utils';
import { useSEO } from '@/hooks/useSEO';
import type { BlogPost } from '@/types';
import { motion } from 'framer-motion';

export function BlogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    blogApi.list(page, 12)
      .then((res: any) => {
        setPosts(res.posts.map((p: any) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          content: p.content,
          excerpt: p.excerpt,
          metaTitle: p.metaTitle || p.meta_title || '',
          metaDescription: p.metaDescription || p.meta_description || '',
          featuredImage: p.featuredImage || p.featured_image || '',
          ogImage: p.ogImage || '',
          canonicalUrl: p.canonicalUrl || '',
          focusKeyword: p.focusKeyword || '',
          seoRobots: p.seoRobots || 'index, follow',
          tags: p.tags || '',
          category: p.category || '',
          customLinkLabel: p.customLinkLabel || '',
          customLinkUrl: p.customLinkUrl || '',
          isFeatured: !!p.isFeatured,
          featuredBookIds: p.featuredBookIds || [],
          status: p.status,
          publishedAt: p.publishedAt || p.published_at || '',
          generatedBy: p.generatedBy || p.generated_by || '',
          createdAt: p.createdAt || p.created_at || '',
          updatedAt: p.updatedAt || p.updated_at || '',
        })));
        setTotalPages(res.pagination?.totalPages || 1);
        setTotal(res.pagination?.total || 0);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [page]);

  useSEO({
    title: page > 1
      ? `Blog - Page ${page} | The Book Times`
      : 'Blog | The Book Times - Reading Lists, Reviews & Literary Insights',
    description: `Explore reading lists, book reviews, and literary insights on the The Book Times blog.${total > 0 ? ` Browse ${total} articles.` : ''}`,
    ogTitle: 'The Book Times Blog - Reading Lists & Literary Insights',
    ogDescription: 'Discover curated reading lists, in-depth book reviews, and literary insights from The Book Times.',
    ogType: 'website',
    ogUrl: `${window.location.origin}/blog${page > 1 ? `?page=${page}` : ''}`,
    canonical: `${window.location.origin}/blog${page > 1 ? `?page=${page}` : ''}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'The Book Times Blog',
      description: 'Reading lists, book reviews, and literary insights',
      url: `${window.location.origin}/blog`,
      publisher: { '@type': 'Organization', name: 'The Book Times' },
    },
  });

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams);
    if (p > 1) params.set('page', String(p));
    else params.delete('page');
    setSearchParams(params, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getGeneratedByLabel = (generatedBy?: string) => {
    switch (generatedBy) {
      case 'ai': return 'AI Generated';
      case 'cron': return 'Auto-Generated';
      default: return 'Editorial';
    }
  };

  const getGeneratedByIcon = (generatedBy?: string) => {
    switch (generatedBy) {
      case 'ai': return <Sparkles className="h-3 w-3" />;
      case 'cron': return <Clock className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  return (
    <main className="pt-20 pb-16">
      <div className="container mx-auto px-4">
        {/* Page Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="default" className="bg-purple-500 mb-4">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered Content
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Blog</h1>
          <p className="text-lg text-muted-foreground">
            Curated reading lists, book recommendations, and literary insights.
            Fresh content every week powered by AI.
          </p>
          {total > 0 && (
            <p className="text-sm text-muted-foreground mt-2">{total} articles published</p>
          )}
        </motion.div>

        {/* Blog Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : posts.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No blog posts yet</h3>
              <p className="text-muted-foreground">Check back soon for new content!</p>
            </div>
          ) : (
            posts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Link to={`/blog/${post.slug}`} className="block h-full">
                  <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full flex flex-col">
                    {/* Featured Image */}
                    <div className="relative h-48 overflow-hidden bg-muted">
                      {post.featuredImage ? (
                        <img
                          src={post.featuredImage}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="absolute top-4 left-4">
                        <Badge variant="secondary" className="bg-white/90 text-foreground">
                          {getGeneratedByIcon(post.generatedBy)}
                          <span className="ml-1">{getGeneratedByLabel(post.generatedBy)}</span>
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="p-6 flex flex-col flex-1">
                      {/* Meta */}
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {post.publishedAt && formatDate(post.publishedAt)}
                        </div>
                        <span className="text-muted-foreground/40">Â·</span>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {calculateReadingTime(post.content.split(/\s+/).length)}
                        </div>
                      </div>

                      {/* Title */}
                      <h2 className="text-xl font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {post.title}
                      </h2>

                      {/* Excerpt */}
                      <p className="text-muted-foreground line-clamp-3 flex-1">
                        {post.excerpt || truncateText(post.content, 160)}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <span className="text-sm text-muted-foreground">
                          {post.featuredBookIds.length} books featured
                        </span>
                        <span className="text-sm font-medium text-primary group-hover:underline">
                          Read More â†’
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? 'default' : 'outline'}
                    size="sm"
                    className="w-9 h-9"
                    onClick={() => goToPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
