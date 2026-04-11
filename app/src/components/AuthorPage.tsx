import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, BookOpen, ArrowLeft, Globe, Award, TrendingUp, Calendar, ExternalLink, MapPin, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { authorsApi, type AuthorDetailResponse } from '@/api/client';
import { useSEO } from '@/hooks/useSEO';
import { motion } from 'framer-motion';

export function AuthorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [author, setAuthor] = useState<AuthorDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSEO({
    title: author ? `${author.name} â€” Books & Biography | The Book Times` : 'Author | The Book Times',
    description: author?.bio || (author ? `Explore all books by ${author.name} on The Book Times.` : ''),
    ...(author && {
      ogType: 'profile',
      ogImage: author.imageUrl,
      canonical: `/author/${author.slug}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: author.name,
        url: `${window.location.origin}/author/${author.slug}`,
        ...(author.imageUrl && { image: author.imageUrl }),
        ...(author.bio && { description: author.bio }),
        ...(author.nationality && { nationality: author.nationality }),
        ...(author.bornDate && { birthDate: author.bornDate }),
        ...(author.diedDate && { deathDate: author.diedDate }),
        sameAs: [
          author.websiteUrl, author.twitterUrl, author.instagramUrl,
          author.goodreadsUrl, author.amazonUrl, author.wikipediaUrl,
          author.facebookUrl, author.youtubeUrl, author.tiktokUrl,
        ].filter(Boolean),
        ...(author.books && author.books.length > 0 && {
          workExample: author.books.map(b => ({
            '@type': 'Book',
            name: b.title,
            url: `${window.location.origin}/book/${b.slug}`,
            ...(b.coverImage && { image: b.coverImage }),
          })),
        }),
      },
    }),
  });

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    authorsApi.getBySlug(slug)
      .then(setAuthor)
      .catch(() => setError('Author not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  // Sort books: top rated first
  const { topRated, otherBooks } = useMemo(() => {
    if (!author?.books?.length) return { topRated: [], otherBooks: [] };
    const sorted = [...author.books].sort((a, b) => (b.computedScore || 0) - (a.computedScore || 0));
    const topCount = Math.min(10, sorted.length);
    return {
      topRated: sorted.slice(0, topCount),
      otherBooks: sorted.slice(topCount),
    };
  }, [author?.books]);

  if (loading) {
    return (
      <div className="min-h-screen">
        {/* Hero skeleton */}
        <div className="bg-gradient-to-b from-primary/5 via-primary/3 to-background">
          <div className="container mx-auto px-4 pt-20 pb-12 md:pt-24 md:pb-16">
            <div className="max-w-5xl mx-auto">
              <Skeleton className="h-5 w-20 mb-8" />
              <div className="flex flex-col md:flex-row items-start gap-8">
                <Skeleton className="w-36 h-36 rounded-full shrink-0" />
                <div className="space-y-4 flex-1 w-full">
                  <Skeleton className="h-10 w-72" />
                  <div className="flex gap-4">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <Skeleton className="h-4 w-full max-w-xl" />
                  <Skeleton className="h-4 w-full max-w-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-5xl mx-auto">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !author) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <div className="p-6 rounded-full bg-muted/50 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Author Not Found</h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          The author you're looking for doesn't exist or has been removed.
        </p>
        <Button asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Home</Link>
        </Button>
      </div>
    );
  }

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  return (
    <div className="min-h-screen">
      {/* â”€â”€ Hero Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-gradient-to-b from-primary/5 via-primary/3 to-background border-b">
        <div className="container mx-auto px-4 pt-20 pb-12 md:pt-24 md:pb-16">
          <div className="max-w-5xl mx-auto">
            {/* Back */}
            <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2 text-muted-foreground hover:text-foreground">
              <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Link>
            </Button>

            <motion.div
              className="flex flex-col md:flex-row items-start gap-6 md:gap-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Avatar */}
              <div className="shrink-0">
                {author.imageUrl ? (
                  <img
                    src={author.imageUrl}
                    alt={author.name}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover ring-4 ring-background shadow-xl"
                  />
                ) : (
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center ring-4 ring-background shadow-xl">
                    <span className="text-4xl md:text-5xl font-bold text-primary">{getInitials(author.name)}</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-serif tracking-tight">
                    {author.name}
                  </h1>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-full px-3 py-1.5 shadow-sm border">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{author.bookCount}</span>
                    <span className="text-muted-foreground">{author.bookCount === 1 ? 'book' : 'books'}</span>
                  </div>
                  {(author.avgRating ?? 0) > 0 && (
                    <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-full px-3 py-1.5 shadow-sm border">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">{author.avgRating}</span>
                      <span className="text-muted-foreground">avg rating</span>
                    </div>
                  )}
                  {author.websiteUrl && (
                    <a
                      href={author.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-full px-3 py-1.5 shadow-sm border hover:border-primary/50 transition-colors"
                    >
                      <Globe className="h-4 w-4 text-primary" />
                      <span className="text-primary font-medium">Website</span>
                      <ExternalLink className="h-3 w-3 text-primary" />
                    </a>
                  )}
                  {author.nationality && (
                    <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-full px-3 py-1.5 shadow-sm border">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">{author.nationality}</span>
                    </div>
                  )}
                  {author.bornDate && (
                    <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-full px-3 py-1.5 shadow-sm border">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        {author.bornDate}{author.diedDate ? ` â€” ${author.diedDate}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Social Links */}
                {(() => {
                  const socials = [
                    { url: author.twitterUrl, label: 'Twitter / X', icon: 'ð•' },
                    { url: author.instagramUrl, label: 'Instagram', icon: 'ðŸ“·' },
                    { url: author.facebookUrl, label: 'Facebook', icon: 'ðŸ“˜' },
                    { url: author.youtubeUrl, label: 'YouTube', icon: 'â–¶ï¸' },
                    { url: author.tiktokUrl, label: 'TikTok', icon: 'ðŸŽµ' },
                    { url: author.goodreadsUrl, label: 'Goodreads', icon: 'ðŸ“š' },
                    { url: author.amazonUrl, label: 'Amazon', icon: 'ðŸ›’' },
                    { url: author.wikipediaUrl, label: 'Wikipedia', icon: 'ðŸ“–' },
                  ].filter(s => s.url);
                  if (!socials.length) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      {socials.map(s => (
                        <a
                          key={s.label}
                          href={s.url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={s.label}
                          className="flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-full px-3 py-1.5 shadow-sm border hover:border-primary/50 transition-colors text-sm"
                        >
                          <span>{s.icon}</span>
                          <span className="text-muted-foreground hover:text-primary transition-colors">{s.label}</span>
                        </a>
                      ))}
                    </div>
                  );
                })()}

                {/* Specialties */}
                {author.specialties && author.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {author.specialties.map(s => (
                      <Badge key={s} variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Genres */}
                {author.genres && author.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {author.genres.map(g => (
                      <Badge key={g} variant="outline" className="rounded-full px-3 py-1 text-xs font-medium border-primary/30 text-primary">
                        {g}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Awards */}
                {author.awards && author.awards.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {author.awards.map(a => (
                      <Badge key={a} className="rounded-full px-3 py-1 text-xs font-medium bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
                        <Trophy className="h-3 w-3 mr-1" />
                        {a}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Bio */}
                {author.bio && (
                  <p className="text-muted-foreground max-w-2xl leading-relaxed text-base">
                    {author.bio}
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Top Rated Books â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {topRated.length > 0 && (
        <section className="container mx-auto px-4 py-10 md:py-14">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="p-1.5 rounded-lg bg-yellow-500/10">
                  <Award className="h-5 w-5 text-yellow-500" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold">Top 10 Books</h2>
                <span className="text-sm text-muted-foreground ml-1">by {author.name}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {topRated.map((book, index) => (
                  <Link key={book.id} to={`/book/${book.slug}`} className="group block">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 * index + 0.3 }}
                    >
                      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-transparent hover:border-primary/20 h-full">
                        <div className="flex gap-4 p-4">
                          {/* Cover */}
                          <div className="relative w-24 sm:w-28 shrink-0">
                            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted shadow-md">
                              {book.coverImage ? (
                                <img
                                  src={book.coverImage}
                                  alt={book.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/20">
                                  <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                                </div>
                              )}
                            </div>
                            {/* Rank badge */}
                            {index < 3 && (
                              <div className={`absolute -top-1.5 -left-1.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${
                                index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                index === 1 ? 'bg-gray-300 text-gray-700' :
                                'bg-amber-600 text-amber-100'
                              }`}>
                                #{index + 1}
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                            <div>
                              <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors mb-1.5">
                                {book.title}
                              </h3>
                              {book.subtitle && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{book.subtitle}</p>
                              )}
                              <div className="flex flex-wrap gap-1 mb-2">
                                {book.categories.slice(0, 2).map(c => (
                                  <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0 rounded-full">{c}</Badge>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                {book.googleRating && (
                                  <>
                                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                    <span className="text-sm font-semibold">{book.googleRating}</span>
                                    {book.ratingsCount > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        ({book.ratingsCount.toLocaleString()})
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                              {book.publishedDate && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {book.publishedDate.substring(0, 4)}
                                </span>
                              )}
                            </div>

                            {book.price != null && book.price > 0 && (
                              <div className="mt-1.5">
                                <span className="text-sm font-bold text-primary">
                                  {book.currency === 'USD' ? '$' : book.currency}{book.price.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* â”€â”€ All Books Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {otherBooks.length > 0 && (
        <section className="bg-muted/30">
          <div className="container mx-auto px-4 py-10 md:py-14">
            <div className="max-w-5xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold">More Books</h2>
                  <Badge variant="secondary" className="ml-1">{otherBooks.length}</Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
                  {otherBooks.map((book, index) => (
                    <motion.div
                      key={book.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 + 0.5 }}
                    >
                      <Link to={`/book/${book.slug}`} className="group block">
                        <Card className="overflow-hidden border-transparent hover:border-primary/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                          <div className="aspect-[2/3] bg-muted relative overflow-hidden">
                            {book.coverImage ? (
                              <img
                                src={book.coverImage}
                                alt={book.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/20">
                                <BookOpen className="h-12 w-12 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                          <CardContent className="p-3 space-y-1.5">
                            <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                              {book.title}
                            </h3>
                            <div className="flex items-center gap-1">
                              {book.googleRating ? (
                                <>
                                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  <span className="text-xs font-medium">{book.googleRating}</span>
                                </>
                              ) : null}
                              {book.publishedDate && (
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {book.publishedDate.substring(0, 4)}
                                </span>
                              )}
                            </div>
                            {book.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {book.categories.slice(0, 2).map(c => (
                                  <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0 rounded-full">{c}</Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* Empty state if no books at all */}
      {author.books.length === 0 && (
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-5xl mx-auto text-center">
            <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">
              No published books found for {author.name} yet.
            </p>
          </div>
        </section>
      )}

      {/* Spacer before footer */}
      <div className="h-8" />
    </div>
  );
}

export default AuthorPage;
