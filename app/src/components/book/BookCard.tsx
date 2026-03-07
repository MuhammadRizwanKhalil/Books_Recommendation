import { memo, useState, useCallback } from 'react';
import { Star, ExternalLink, Heart, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Book } from '@/types';
import { formatPrice, formatRating, getStarRating, truncateText } from '@/lib/utils';
import { getOptimizedImageUrl, getImageSrcSet, getImageSizes } from '@/lib/imageUtils';
import { prefetchBook } from '@/lib/prefetch';
import { useWishlist } from '@/components/WishlistProvider';
import { useAuth } from '@/components/AuthProvider';
import { useAppNav } from '@/App';
import { analyticsApi } from '@/api/client';

interface BookCardProps {
  book: Book;
  variant?: 'compact' | 'standard' | 'featured';
  showAffiliate?: boolean;
}

// Fallback placeholder for broken images
const FALLBACK_COVER = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">
    <rect width="200" height="300" fill="#f3f0ea"/>
    <text x="100" y="140" text-anchor="middle" font-family="system-ui" font-size="48" fill="#c2995c">📚</text>
    <text x="100" y="180" text-anchor="middle" font-family="system-ui" font-size="12" fill="#8a7a68">No Cover</text>
  </svg>`
);

// Book cover with error handling, CLS prevention, and responsive srcSet
function BookImage({ src, alt, className, loading, fetchPriority, variant = 'standard' }: { 
  src: string; alt: string; className?: string; loading?: 'lazy' | 'eager'; fetchPriority?: 'high' | 'low';
  variant?: 'compact' | 'standard' | 'featured';
}) {
  const optimizedSrc = getOptimizedImageUrl(src, { width: 400, quality: 80 });
  const srcSet = getImageSrcSet(src);
  const sizes = getImageSizes(variant);
  const [imgSrc, setImgSrc] = useState(src ? optimizedSrc : FALLBACK_COVER);
  const [useSrcSet, setUseSrcSet] = useState(!!src);
  const handleError = useCallback(() => { setImgSrc(FALLBACK_COVER); setUseSrcSet(false); }, []);

  return (
    <img
      src={imgSrc}
      srcSet={useSrcSet ? srcSet : undefined}
      sizes={useSrcSet ? sizes : undefined}
      alt={alt}
      width={200}
      height={300}
      className={className}
      loading={loading || 'lazy'}
      decoding="async"
      fetchPriority={fetchPriority}
      onError={handleError}
    />
  );
}

export const BookCard = memo(function BookCard({ book, variant = 'standard', showAffiliate = true }: BookCardProps) {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { openBook, navigate } = useAppNav();
  const { isAdmin } = useAuth();
  const isLiked = isInWishlist(book.id);
  const stars = getStarRating(book.googleRating);
  const imgAlt = `${book.title} by ${book.author} - book cover`;

  const handlePrefetch = useCallback(() => {
    if (book.slug) prefetchBook(book.slug);
  }, [book.slug]);

  const handleAffiliateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.sendBeacon) {
      const data = JSON.stringify({ bookId: book.id, source: 'card' });
      navigator.sendBeacon(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/analytics/affiliate-click`,
        new Blob([data], { type: 'application/json' })
      );
    } else {
      analyticsApi.trackAffiliateClick(book.id).catch(() => {});
    }
  };

  if (variant === 'compact') {
    return (
      <article itemScope itemType="https://schema.org/Book">
        <Card 
          className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-transparent hover:border-primary/20"
          onClick={() => openBook(book)}
          onMouseEnter={handlePrefetch}
          onFocus={handlePrefetch}
        >
          <div className="relative aspect-[2/3] overflow-hidden">
            <BookImage
              src={book.coverImage}
              alt={imgAlt}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              variant="compact"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-2 top-2 h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm opacity-100 md:opacity-0 transition-opacity duration-300 md:group-hover:opacity-100 shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleWishlist(book);
              }}
              aria-label={isLiked ? `Remove ${book.title} from wishlist` : `Add ${book.title} to wishlist`}
            >
              <Heart className={`h-4 w-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
            </Button>
            {isAdmin && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute left-2 top-2 h-8 w-8 rounded-full bg-orange-500/90 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate({ type: 'admin', page: 'books' });
                }}
                aria-label={`Edit ${book.title} in admin`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <CardContent className="p-3">
            <h3 className="line-clamp-1 font-semibold text-sm" itemProp="name">{book.title}</h3>
            {book.authorData?.slug ? (
              <Link to={`/author/${book.authorData.slug}`} onClick={(e) => e.stopPropagation()} className="line-clamp-1 text-xs text-muted-foreground hover:text-primary hover:underline transition-colors" itemProp="author">{book.author}</Link>
            ) : (
              <p className="line-clamp-1 text-xs text-muted-foreground" itemProp="author">{book.author}</p>
            )}
            <div className="mt-2 flex items-center gap-1" role="img" aria-label={`Rating: ${formatRating(book.googleRating)} out of 5 stars`}>
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-medium">{formatRating(book.googleRating)}</span>
            </div>
          </CardContent>
        </Card>
      </article>
    );
  }

  if (variant === 'featured') {
    return (
      <article itemScope itemType="https://schema.org/Book">
        <Card 
          className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
          onClick={() => openBook(book)}
          onMouseEnter={handlePrefetch}
          onFocus={handlePrefetch}
        >
          <div className="grid md:grid-cols-2 gap-0">
            <div className="relative aspect-[2/3] md:aspect-auto overflow-hidden max-h-[400px] md:max-h-none">
              <BookImage
                src={book.coverImage}
                alt={imgAlt}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="eager"
                fetchPriority="high"
                variant="featured"
              />
              <div className="absolute top-4 left-4">
                <Badge className="bg-primary text-primary-foreground">Featured</Badge>
              </div>
              {isAdmin && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-4 top-4 h-8 w-8 rounded-full bg-orange-500/90 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate({ type: 'admin', page: 'books' });
                  }}
                  title="Edit in admin"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <CardContent className="p-4 sm:p-6 flex flex-col justify-center">
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold line-clamp-2">{book.title}</h3>
                  {book.subtitle && (
                    <p className="text-muted-foreground line-clamp-1">{book.subtitle}</p>
                  )}
                </div>
                {book.authorData?.slug ? (
                  <Link to={`/author/${book.authorData.slug}`} onClick={(e) => e.stopPropagation()} className="text-lg font-medium text-primary hover:underline transition-colors">{book.author}</Link>
                ) : (
                  <p className="text-lg font-medium">{book.author}</p>
                )}
                
                <div className="flex items-center gap-2" role="img" aria-label={`Rating: ${formatRating(book.googleRating)} out of 5 stars`}>
                  <div className="flex items-center gap-0.5" aria-hidden="true">
                    {Array.from({ length: stars.full }).map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                    {stars.half && <Star className="h-5 w-5 fill-yellow-400/50 text-yellow-400" />}
                    {Array.from({ length: stars.empty }).map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-gray-300" />
                    ))}
                  </div>
                  <span className="font-medium">{formatRating(book.googleRating)}</span>
                  <span className="text-muted-foreground">({book.ratingsCount.toLocaleString()} ratings)</span>
                </div>

                <p className="text-muted-foreground line-clamp-3">{truncateText(book.description, 200)}</p>

                <div className="flex flex-wrap gap-2">
                  {book.categories.slice(0, 3).map((category) => (
                    <Badge key={category} variant="secondary">{category}</Badge>
                  ))}
                </div>

                <div className="flex items-center gap-4 pt-4">
                  {book.price && (
                    <span className="text-2xl font-bold">{formatPrice(book.price, book.currency)}</span>
                  )}
                  {showAffiliate && book.amazonUrl && (
                    <Button 
                      className="flex-1" 
                      onClick={handleAffiliateClick}
                      asChild
                    >
                      <a 
                        href={book.amazonUrl} 
                        target="_blank" 
                        rel="nofollow sponsored noopener noreferrer"
                      >
                        Buy on Amazon
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      </article>
    );
  }

  // Standard variant
  return (
    <article itemScope itemType="https://schema.org/Book">
      <Card 
        className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 border-transparent hover:border-primary/20"
        onClick={() => openBook(book)}
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
      >
        <div className="relative aspect-[2/3] overflow-hidden">
          <BookImage
            src={book.coverImage}
            alt={imgAlt}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-2 top-2 h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm opacity-100 md:opacity-0 transition-opacity duration-300 md:group-hover:opacity-100 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(book);
            }}
            aria-label={isLiked ? `Remove ${book.title} from wishlist` : `Add ${book.title} to wishlist`}
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
          </Button>
          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute left-2 top-2 h-8 w-8 rounded-full bg-orange-500/90 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                navigate({ type: 'admin', page: 'books' });
              }}
              aria-label={`Edit ${book.title} in admin`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors" itemProp="name">{book.title}</h3>
          {book.authorData?.slug ? (
            <Link to={`/author/${book.authorData.slug}`} onClick={(e) => e.stopPropagation()} className="text-sm text-muted-foreground line-clamp-1 mt-0.5 hover:text-primary hover:underline transition-colors" itemProp="author">{book.author}</Link>
          ) : (
            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5" itemProp="author">{book.author}</p>
          )}
          
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1" role="img" aria-label={`Rating: ${formatRating(book.googleRating)} out of 5 stars`}>
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{formatRating(book.googleRating)}</span>
              <span className="text-xs text-muted-foreground">({book.ratingsCount.toLocaleString()})</span>
            </div>
            {book.price && (
              <span className="font-semibold text-primary">{formatPrice(book.price, book.currency)}</span>
            )}
          </div>

          {showAffiliate && book.amazonUrl && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-3 opacity-100 md:opacity-0 transition-opacity duration-300 md:group-hover:opacity-100 text-xs"
              onClick={handleAffiliateClick}
              asChild
            >
              <a 
                href={book.amazonUrl} 
                target="_blank" 
                rel="nofollow sponsored noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                View on Amazon
                <ExternalLink className="ml-2 h-3 w-3" />
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </article>
  );
});
