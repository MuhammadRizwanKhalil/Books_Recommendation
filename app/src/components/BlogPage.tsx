import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, Calendar, Clock, Sparkles, ChevronLeft, ChevronRight, BookOpen, TrendingUp, Tag, ArrowRight, Star, Crown, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { blogApi } from '@/api/client';
import { formatDate, calculateReadingTime, truncateText, parseTags } from '@/lib/utils';
import { useSEO } from '@/hooks/useSEO';
import { useTopRated } from '@/hooks/useBooks';
import { Top20Carousel } from '@/sections/Top20Carousel';
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
    blogApi.list(page, 12, 'PUBLISHED')
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
    <main className="pb-16">
      <div className="container mx-auto px-4">
        {/* Page Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <Badge variant="default" className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0 px-3 py-1">
              <Sparkles className="w-3 h-3 mr-1" />
              Featured Content
            </Badge>
            <Badge variant="outline" className="text-xs text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/5">
              <Clock className="w-3 h-3 mr-1" />
              Updated Weekly
            </Badge>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-serif mb-4">Our Blog</h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Curated reading lists, book recommendations, and literary insights.
            Fresh content every week.
          </p>
          {total > 0 && (
            <p className="text-sm text-muted-foreground mt-3 font-medium">{total} articles published</p>
          )}
        </motion.div>

        {/* Featured Post (first post on page 1) */}
        {page === 1 && !loading && posts.length > 0 && (
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Link to={`/blog/${posts[0].slug}`} className="block group">
              <Card className="overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500">
                <div className="grid lg:grid-cols-2">
                  <div className="relative h-64 lg:h-auto min-h-[300px] overflow-hidden bg-muted">
                    {posts[0].featuredImage ? (
                      <img
                        src={posts[0].featuredImage}
                        alt={posts[0].title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 via-purple-500/10 to-pink-500/10 flex items-center justify-center">
                        <FileText className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent lg:bg-none" />
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-md">
                        <Flame className="w-3 h-3 mr-1" />
                        Featured
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="bg-muted">
                        {getGeneratedByIcon(posts[0].generatedBy)}
                        <span className="ml-1">{getGeneratedByLabel(posts[0].generatedBy)}</span>
                      </Badge>
                      {posts[0].category && (
                        <Badge variant="outline" className="text-xs">{posts[0].category}</Badge>
                      )}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-3 line-clamp-3 group-hover:text-primary transition-colors leading-snug">
                      {posts[0].title}
                    </h2>
                    <p className="text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                      {posts[0].excerpt || truncateText(posts[0].content, 200)}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {posts[0].publishedAt && formatDate(posts[0].publishedAt)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {calculateReadingTime(posts[0].content.split(/\s+/).length)}
                      </div>
                      {posts[0].featuredBookIds.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5" />
                          {posts[0].featuredBookIds.length} books
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-primary group-hover:underline flex items-center w-fit">
                      Read Full Article
                      <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </CardContent>
                </div>
              </Card>
            </Link>
          </motion.div>
        )}

        {/* Blog Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden border-0 shadow-md">
                <Skeleton className="h-52 w-full" />
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
            (page === 1 ? posts.slice(1) : posts).map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Link to={`/blog/${post.slug}`} className="block h-full">
                  <Card className="group overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full flex flex-col border-0 shadow-md">
                    {/* Featured Image */}
                    <div className="relative h-52 overflow-hidden bg-muted">
                      {post.featuredImage ? (
                        <img
                          src={post.featuredImage}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 via-purple-500/5 to-pink-500/5 flex items-center justify-center">
                          <FileText className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm text-foreground shadow-sm">
                          {getGeneratedByIcon(post.generatedBy)}
                          <span className="ml-1">{getGeneratedByLabel(post.generatedBy)}</span>
                        </Badge>
                      </div>
                      {post.category && (
                        <div className="absolute bottom-4 left-4">
                          <Badge className="bg-primary/90 backdrop-blur-sm text-primary-foreground text-[10px] shadow-sm">
                            {post.category}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-5 sm:p-6 flex flex-col flex-1">
                      {/* Meta */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {post.publishedAt && formatDate(post.publishedAt)}
                        </div>
                        <span className="text-muted-foreground/30">&middot;</span>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {calculateReadingTime(post.content.split(/\s+/).length)}
                        </div>
                      </div>

                      {/* Title */}
                      <h2 className="text-lg font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                        {post.title}
                      </h2>

                      {/* Excerpt */}
                      <p className="text-sm text-muted-foreground line-clamp-3 flex-1 leading-relaxed">
                        {post.excerpt || truncateText(post.content, 160)}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        {post.featuredBookIds.length > 0 ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <BookOpen className="h-3 w-3" />
                            {post.featuredBookIds.length} books featured
                          </div>
                        ) : (
                          <span />
                        )}
                        <span className="text-sm font-medium text-primary group-hover:underline flex items-center">
                          Read More
                          <ChevronRight className="ml-0.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
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
              className="shadow-sm"
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
                    className={`w-9 h-9 ${pageNum === page ? 'shadow-md shadow-primary/20' : ''}`}
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
              className="shadow-sm"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Top 20 Books Carousel */}
        <div className="mt-16">
          <Separator className="mb-8" />
          <Top20Carousel />
        </div>
      </div>
    </main>
  );
}
