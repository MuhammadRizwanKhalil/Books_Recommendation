import { FileText, ChevronRight, Clock, Sparkles, Calendar, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBlogPosts } from '@/hooks/useBooks';
import { formatDate, truncateText } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { useAppNav } from '@/App';
import { motion } from 'framer-motion';

export function Blog() {
  const { posts, loading } = useBlogPosts(5);
  const { isAdmin } = useAuth();
  const { navigate } = useAppNav();

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
      case 'cron': return 'Auto Generated';
      default: return 'Editorial';
    }
  };

  if (loading) {
    return (
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 h-80 bg-muted rounded-2xl animate-pulse" />
            <div className="lg:col-span-2 space-y-4">
              <div className="h-[152px] bg-muted rounded-2xl animate-pulse" />
              <div className="h-[152px] bg-muted rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (posts.length === 0) return null;

  const [hero, ...rest] = posts;
  const sidePosts = rest.slice(0, 2);
  const bottomPosts = rest.slice(2);

  return (
    <section id="blog" className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <motion.div
          className="flex items-end justify-between mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />AI-Powered
              </Badge>
              <Badge variant="outline" className="text-xs">Updated Weekly</Badge>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">From the Blog</h2>
            <p className="text-muted-foreground mt-1">Book lists, reviews, and reading guides</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/blog">View All <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </motion.div>

        {/* Magazine layout: hero left + 2 stacked right */}
        <div className="grid lg:grid-cols-5 gap-4">
          {/* Hero post */}
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <Link to={`/blog/${hero.slug}`} className="group relative block h-full rounded-2xl overflow-hidden border shadow-sm hover:shadow-xl transition-all duration-500">
              {isAdmin && (
                <button
                  className="absolute right-3 top-3 z-10 h-7 w-7 rounded-full bg-orange-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate({ type: 'admin', page: 'blog' }); }}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              <div className="relative h-full min-h-[320px] lg:min-h-[400px]">
                {hero.featuredImage ? (
                  <img src={hero.featuredImage} alt={hero.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center">
                    <FileText className="h-12 w-12 text-muted-foreground/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="bg-white/20 backdrop-blur-sm text-white text-xs">
                      {getGeneratedByIcon(hero.generatedBy)}
                      <span className="ml-1">{getGeneratedByLabel(hero.generatedBy)}</span>
                    </Badge>
                    <span className="text-white/60 text-xs flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {hero.publishedAt && formatDate(hero.publishedAt)}
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-white leading-tight mb-2 group-hover:underline decoration-2 underline-offset-4">
                    {hero.title}
                  </h3>
                  <p className="text-white/70 text-sm line-clamp-2 max-w-lg">
                    {hero.excerpt || truncateText(hero.content, 160)}
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Side posts */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {sidePosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex-1"
              >
                <Link to={`/blog/${post.slug}`} className="group relative flex h-full rounded-2xl overflow-hidden border shadow-sm hover:shadow-lg transition-all duration-300">
                  <div className="relative w-32 sm:w-40 shrink-0">
                    {post.featuredImage ? (
                      <img src={post.featuredImage} alt={post.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center p-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {getGeneratedByIcon(post.generatedBy)}
                        <span className="ml-0.5">{getGeneratedByLabel(post.generatedBy)}</span>
                      </Badge>
                    </div>
                    <h4 className="font-bold text-sm line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                      {post.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {post.excerpt || truncateText(post.content, 80)}
                    </p>
                    <span className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {post.publishedAt && formatDate(post.publishedAt)}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom row for remaining posts */}
        {bottomPosts.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {bottomPosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Link to={`/blog/${post.slug}`} className="group flex items-center gap-3 p-3 rounded-xl border hover:shadow-md transition-all duration-300">
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0">
                    {post.featuredImage ? (
                      <img src={post.featuredImage} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <FileText className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">{post.title}</h4>
                    <span className="text-[10px] text-muted-foreground">{post.publishedAt && formatDate(post.publishedAt)}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        <div className="flex justify-center mt-6 sm:hidden">
          <Button variant="outline" size="sm" asChild>
            <Link to="/blog">View All Posts <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
