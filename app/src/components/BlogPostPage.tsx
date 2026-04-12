import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Calendar, Clock, Sparkles, FileText, BookOpen, ArrowLeft, Share2, ChevronRight, Tag, Heart, Eye, Quote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { blogApi } from '@/api/client';
import { formatDate, calculateReadingTime } from '@/lib/utils';
import { useSEO } from '@/hooks/useSEO';
import type { BlogPost } from '@/types';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(false);
    blogApi.getBySlug(slug)
      .then((p: any) => {
        setPost({
          id: p.id,
          title: p.title,
          slug: p.slug,
          content: p.content,
          excerpt: p.excerpt || '',
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
          adminNotes: p.adminNotes || '',
          allowComments: p.allowComments !== false,
          isFeatured: !!p.isFeatured,
          featuredBookIds: p.featuredBookIds || [],
          status: p.status,
          publishedAt: p.publishedAt || p.published_at || '',
          generatedBy: p.generatedBy || p.generated_by || '',
          createdAt: p.createdAt || p.created_at || '',
          updatedAt: p.updatedAt || p.updated_at || '',
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // Build structured data for the blog post
  const blogPostJsonLd = useMemo(() => {
    if (!post) return undefined;
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.metaDescription || post.excerpt || '',
      image: post.featuredImage || undefined,
      datePublished: post.publishedAt || post.createdAt,
      dateModified: post.updatedAt || post.createdAt,
      author: { '@type': 'Organization', name: 'The Book Times' },
      publisher: { '@type': 'Organization', name: 'The Book Times' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${window.location.origin}/blog/${slug}` },
    };
  }, [post, slug]);

  useSEO({
    title: post ? (post.metaTitle || `${post.title} | The Book Times Blog`) : 'Loading... | The Book Times Blog',
    description: post ? (post.metaDescription || post.excerpt || post.content?.slice(0, 160)) : undefined,
    ogTitle: post?.metaTitle || post?.title,
    ogDescription: post ? (post.metaDescription || post.excerpt || post.content?.slice(0, 160)) : undefined,
    ogImage: post?.ogImage || post?.featuredImage || undefined,
    ogType: 'article',
    ogUrl: `${window.location.origin}/blog/${slug}`,
    canonical: post?.canonicalUrl || `${window.location.origin}/blog/${slug}`,
    robots: post?.seoRobots || 'index, follow',
    jsonLd: blogPostJsonLd,
    extraMeta: post?.publishedAt ? [
      { attr: 'property', key: 'article:published_time', content: post.publishedAt },
      ...(post.updatedAt ? [{ attr: 'property' as const, key: 'article:modified_time', content: post.updatedAt }] : []),
      { attr: 'property', key: 'article:author', content: 'The Book Times' },
      { attr: 'property', key: 'article:section', content: 'Books' },
    ] : undefined,
  });

  const getGeneratedByIcon = (generatedBy?: string) => {
    switch (generatedBy) {
      case 'ai': return <Sparkles className="h-3 w-3" />;
      case 'cron': return <Clock className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  const getGeneratedByLabel = (generatedBy?: string) => {
    switch (generatedBy) {
      case 'ai': return 'AI Generated';
      case 'cron': return 'Auto-Generated';
      default: return 'Editorial';
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: post?.title, url: window.location.href });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  // Loading state
  if (loading) {
    return (
      <main className="pt-20 pb-16">
        <article className="container mx-auto px-4 max-w-4xl">
          <Skeleton className="h-6 w-48 mb-6" />
          <Skeleton className="h-[400px] w-full rounded-2xl mb-8" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <div className="flex gap-4 mb-8">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </article>
      </main>
    );
  }

  // Error / not found
  if (error || !post) {
    return (
      <main className="pt-20 pb-16">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-2">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Blog post not found</h1>
          <p className="text-muted-foreground max-w-md text-center">The article you're looking for doesn't exist or has been removed.</p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            <Button asChild>
              <Link to="/blog">Browse All Posts</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const readingTime = calculateReadingTime(post.content.split(/\s+/).length);
  const wordCount = post.content.split(/\s+/).length;

  // Render content: support basic HTML or split by paragraphs
  const isHtml = /<[a-z][\s\S]*>/i.test(post.content);
  const sanitizedHtml = isHtml ? DOMPurify.sanitize(post.content, {
    ADD_ATTR: ['class', 'target', 'rel'],
    ADD_TAGS: ['iframe'],
  }) : '';

  const tags = post.tags ? post.tags.split(',').filter(t => t.trim()) : [];

  return (
    <main className="pt-20 pb-16">
      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 max-w-4xl mb-6">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground line-clamp-1 font-medium">{post.title}</span>
        </nav>
      </div>

      <article className="container mx-auto px-4 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Hero Image */}
          {post.featuredImage && (
            <div className="relative rounded-2xl overflow-hidden mb-8 aspect-[2/1] shadow-xl">
              <img
                src={post.featuredImage}
                alt={post.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          )}

          {/* Badges Row */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <Badge variant="secondary" className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20">
              {getGeneratedByIcon(post.generatedBy)}
              <span className="ml-1">{getGeneratedByLabel(post.generatedBy)}</span>
            </Badge>
            {post.category && (
              <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0">
                {post.category}
              </Badge>
            )}
            {post.isFeatured && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                <Heart className="h-3 w-3 mr-1" />
                Featured
              </Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif leading-tight mb-6">
            {post.title}
          </h1>

          {/* Meta Bar */}
          <Card className="border-0 shadow-md mb-8">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
                {post.publishedAt && (
                  <time dateTime={post.publishedAt} className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>{formatDate(post.publishedAt)}</span>
                  </time>
                )}
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{readingTime}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-primary" />
                  <span>{wordCount.toLocaleString()} words</span>
                </div>
                {post.featuredBookIds.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span>{post.featuredBookIds.length} books featured</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto shadow-sm"
                  onClick={handleShare}
                >
                  <Share2 className="h-4 w-4 mr-1.5" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Excerpt */}
          {post.excerpt && (
            <div className="relative mb-10 pl-6">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-purple-500 to-pink-500 rounded-full" />
              <Quote className="h-5 w-5 text-primary/40 mb-2" />
              <p className="text-lg text-muted-foreground italic leading-relaxed">
                {post.excerpt}
              </p>
            </div>
          )}

          {/* Content */}
          {isHtml ? (
            <div
              className="prose prose-lg dark:prose-invert max-w-none mb-12
                prose-headings:font-serif prose-headings:font-bold
                prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:pb-2 prose-h2:border-border
                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                prose-p:leading-relaxed prose-p:text-foreground/80
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-a:font-medium
                prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                prose-strong:text-foreground prose-strong:font-semibold
                prose-ul:my-6 prose-ol:my-6
                prose-li:leading-relaxed
                prose-img:rounded-xl prose-img:shadow-lg
                prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-muted prose-pre:rounded-xl prose-pre:shadow-md"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <div className="prose prose-lg dark:prose-invert max-w-none mb-12 prose-headings:font-serif">
              {post.content.split('\n\n').map((paragraph, idx) => (
                <p key={idx} className="text-foreground/80 leading-relaxed mb-5">
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {/* Custom Link CTA */}
          {post.customLinkLabel && post.customLinkUrl && (
            <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 mb-10">
              <CardContent className="p-6 sm:p-8 text-center">
                <p className="text-sm text-muted-foreground mb-1 uppercase tracking-wide font-medium">Recommended Resource</p>
                <p className="text-lg font-semibold mb-4">{post.customLinkLabel}</p>
                <Button asChild size="lg" className="shadow-md">
                  <a href={post.customLinkUrl} target="_blank" rel="noopener noreferrer">
                    Explore Now
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          <Separator className="mb-8" />

          {/* Tags & Category */}
          <div className="flex flex-wrap items-start gap-6 mb-8">
            {tags.length > 0 && (
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-xs hover:bg-muted transition-colors cursor-default">
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {post.category && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Category</span>
                </div>
                <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0">
                  {post.category}
                </Badge>
              </div>
            )}
          </div>

          <Separator className="mb-6" />

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => navigate(-1)} className="shadow-sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="outline" asChild className="shadow-sm">
              <Link to="/blog">
                All Posts
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </article>
    </main>
  );
}
