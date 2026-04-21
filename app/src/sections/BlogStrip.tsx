import { ChevronRight, Calendar, FileText, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBlogPosts } from '@/hooks/useBooks';
import { formatDate, truncateText } from '@/lib/utils';
import { motion } from 'framer-motion';

/**
 * Compact "Latest from the Blog" strip — bottom-of-homepage variant.
 * 3 small cards in a row, no hero, no side stack. Designed to be lightweight
 * and consistent with other home sections (TopRated/Top20 header style).
 */
export function BlogStrip() {
  const { posts, loading } = useBlogPosts(3);

  if (loading) {
    return (
      <section className="py-12 md:py-16 border-t bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <div className="h-7 w-44 bg-muted rounded animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse mt-2" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (posts.length === 0) return null;

  return (
    <section id="blog-strip" className="py-12 md:py-16 border-t bg-muted/20">
      <div className="container mx-auto px-4">
        <motion.div
          className="flex items-end justify-between mb-6"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Latest from the Blog
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Quick reads, lists, and reviews</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/blog">All Articles <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post, idx) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
            >
              <Link
                to={`/blog/${post.slug}`}
                className="group flex gap-3 p-3 rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all duration-300 h-full"
              >
                <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
                  {post.featuredImage ? (
                    <img
                      src={post.featuredImage}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {post.excerpt || truncateText(post.content, 70)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {post.publishedAt && (
                      <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {formatDate(post.publishedAt)}
                      </span>
                    )}
                    {post.generatedBy === 'ai' && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">AI</Badge>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center mt-6 sm:hidden">
          <Button variant="outline" size="sm" asChild>
            <Link to="/blog">All Articles <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
