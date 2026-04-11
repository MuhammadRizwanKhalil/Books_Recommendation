import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Calendar, Clock, Sparkles, FileText, BookOpen, ArrowLeft, Share2, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
        <article className="container mx-auto px-4 max-w-3xl">
          <Skeleton className="h-6 w-32 mb-6" />
          <Skeleton className="h-64 w-full rounded-xl mb-8" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <div className="flex gap-4 mb-8">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
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
          <FileText className="h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Blog post not found</h1>
          <p className="text-muted-foreground">The article you're looking for doesn't exist or has been removed.</p>
          <div className="flex gap-3">
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

  // Render content: support basic HTML or split by paragraphs
  const isHtml = /<[a-z][\s\S]*>/i.test(post.content);
  const sanitizedHtml = isHtml ? DOMPurify.sanitize(post.content) : '';

  return (
    <main className="pt-20 pb-16">
      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 max-w-3xl mb-6">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground line-clamp-1">{post.title}</span>
        </nav>
      </div>

      <article className="container mx-auto px-4 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Hero Image */}
          {post.featuredImage && (
            <div className="relative rounded-xl overflow-hidden mb-8 aspect-video">
              <img
                src={post.featuredImage}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Badge */}
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary">
              {getGeneratedByIcon(post.generatedBy)}
              <span className="ml-1">{getGeneratedByLabel(post.generatedBy)}</span>
            </Badge>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
            {post.publishedAt && (
              <time dateTime={post.publishedAt} className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(post.publishedAt)}
              </time>
            )}
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {readingTime}
            </div>
            {post.featuredBookIds.length > 0 && (
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                {post.featuredBookIds.length} books featured
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>
          </div>

          <Separator className="mb-8" />

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-lg text-muted-foreground italic border-l-4 border-primary pl-4 mb-8">
              {post.excerpt}
            </p>
          )}

          {/* Content */}
          {isHtml ? (
            <div
              className="prose prose-lg dark:prose-invert max-w-none mb-12"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <div className="prose prose-lg dark:prose-invert max-w-none mb-12">
              {post.content.split('\n\n').map((paragraph, idx) => (
                <p key={idx} className="text-muted-foreground leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {/* Custom Link CTA */}
          {post.customLinkLabel && post.customLinkUrl && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 mb-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">Recommended Resource</p>
              <Button asChild>
                <a href={post.customLinkUrl} target="_blank" rel="noopener noreferrer">
                  {post.customLinkLabel}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </a>
              </Button>
            </div>
          )}

          {/* Tags */}
          {post.tags && (
            <>
              <Separator className="mb-6" />
              <div className="flex items-center gap-2 flex-wrap mb-8">
                <span className="text-sm font-medium">Tags:</span>
                {post.tags.split(',').filter(t => t.trim()).map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {tag.trim()}
                  </Badge>
                ))}
              </div>
            </>
          )}

          {/* Category */}
          {post.category && (
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm font-medium">Category:</span>
              <Badge variant="secondary">{post.category}</Badge>
            </div>
          )}

          {/* Navigation */}
          <Separator className="mb-6" />
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="outline" asChild>
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
