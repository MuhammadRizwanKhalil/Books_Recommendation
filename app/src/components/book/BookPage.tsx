import { Heart, ExternalLink, ShoppingCart, ChevronLeft, BookOpen, Calendar, Building2, BarChart3, User as UserIcon, Pencil, Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Book } from '@/types';
import { formatPrice, formatRating, formatDate, formatNumber, generateBookStructuredData } from '@/lib/utils';
import { BookReviews } from './BookReviews';
import { BookRecommendations } from './BookRecommendations';
import { FeaturedInBlog } from './FeaturedInBlog';
import { BookQuotes } from '@/components/BookQuotes';
import { SeriesBadge } from './SeriesBadge';
import { MoodTags } from './MoodTags';
import { PaceIndicator } from './PaceIndicator';
import { AuthorSection } from './AuthorSection';
import { ReadingCounts } from './ReadingCounts';
import { FriendsReadingThis } from './FriendsReadingThis';
import { BookDiscussions } from './BookDiscussions';
import { CommunityPrompts } from './CommunityPrompts';
import { ContentWarnings } from './ContentWarnings';
import { CharactersList } from './CharactersList';
import { InlineRatingWidget } from './InlineRatingWidget';
import { StarDisplay } from '@/components/ui/star-display';
import { useWishlist } from '@/components/WishlistProvider';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSEO } from '@/hooks/useSEO';
import { ReadingStatusButton } from '@/components/ReadingStatus';
import { Link } from 'react-router-dom';
import { SocialShare } from '@/components/SocialShare';
import { AddToListButton } from './AddToListButton';
import { TBRQueueButton } from '@/components/TBRQueueButton';
import { OwnedBookButton } from '@/components/OwnedBookButton';
import { EditionsBrowser } from './EditionsBrowser';
import { ProgressTracker } from './ProgressTracker';
import { CoverZoom } from './CoverZoom';
import { TagManager } from './TagManager';
import { ReadingJournal } from './ReadingJournal';
import { BookQuizzes } from './BookQuizzes';
import { analyticsApi } from '@/api/client';
import { isAnalyticsEnabled } from '@/lib/analytics';
import { StoryArcChart } from './StoryArcChart';
import { AIInsights } from './AIInsights';
import { useNavigate } from 'react-router-dom';

interface BookPageProps {
  book: Book;
  onBack: () => void;
}

export function BookPage({ book, onBack }: BookPageProps) {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { addToReadingHistory, isAuthenticated, isAdmin } = useAuth();
  const routerNavigate = useNavigate();
  const isLiked = isInWishlist(book.id);
  const structuredData = generateBookStructuredData(book);
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: window.location.origin },
      ...(book.categories.length > 0
        ? [{ '@type': 'ListItem', position: 2, name: book.categories[0], item: `${window.location.origin}/category/${book.categories[0].toLowerCase().replace(/\s+/g, '-')}` }]
        : []),
      { '@type': 'ListItem', position: book.categories.length > 0 ? 3 : 2, name: book.title },
    ],
  };

  useSEO({
    title: book.metaTitle || `${book.title} by ${book.author} | The Book Times`,
    description: book.metaDescription || `Read ${book.title} by ${book.author}. ${book.description?.slice(0, 150)}...`,
    ogTitle: book.title,
    ogDescription: `${book.title} by ${book.author} â€” Rating: ${book.googleRating}/5`,
    ogImage: book.ogImage || book.coverImage,
    ogType: 'book',
    ogUrl: `${window.location.origin}/book/${book.slug}`,
    canonical: book.canonicalUrl || `${window.location.origin}/book/${book.slug}`,
    robots: book.seoRobots || 'index, follow',
    jsonLd: [structuredData, breadcrumbJsonLd],
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (isAuthenticated) {
      addToReadingHistory({
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        bookCover: book.coverImage,
        bookSlug: book.slug,
      });
    }
  }, [book.id]);

  const handleAffiliateClick = () => {
    if (!isAnalyticsEnabled()) return;
    if (navigator.sendBeacon) {
      const data = JSON.stringify({ bookId: book.id, source: 'book-page' });
      navigator.sendBeacon(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/analytics/affiliate-click`,
        new Blob([data], { type: 'application/json' }),
      );
    } else {
      analyticsApi.trackAffiliateClick(book.id).catch(() => {});
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background"
    >
      {/* Unified top bar: Back + inline breadcrumb + admin edit (one row, no duplication) */}
      <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 shrink-0 -ml-2">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-5 hidden sm:block" />
          <nav aria-label="Breadcrumb" className="flex-1 min-w-0 hidden sm:block">
            <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
              {book.categories.length > 0 && (
                <>
                  <li aria-hidden className="select-none">/</li>
                  <li className="truncate max-w-[140px]">
                    <Link
                      to={`/category/${book.categories[0].toLowerCase().replace(/\s+/g, '-')}`}
                      className="hover:text-primary transition-colors"
                    >
                      {book.categories[0]}
                    </Link>
                  </li>
                </>
              )}
              <li aria-hidden className="select-none">/</li>
              <li className="text-foreground font-medium truncate">{book.title}</li>
            </ol>
          </nav>
          <span className="sm:hidden flex-1 min-w-0 text-sm font-medium truncate">{book.title}</span>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-950"
              onClick={() => routerNavigate(`/admin/books/edit/${encodeURIComponent(book.slug || book.id)}`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Edit Book</span>
            </Button>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 pt-4 pb-8 sm:pt-6">
        {/* ====== MAIN LAYOUT ====== */}
        <div className="grid lg:grid-cols-[340px_1fr] gap-6 lg:gap-10">

          {/* LEFT COLUMN â€” Image + Affiliate */}
          <div className="space-y-5 lg:max-w-none">
            {/* Cover with zoom modal */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <CoverZoom
                bookId={book.id}
                title={book.title}
                fallbackCoverImage={book.coverImage}
              />
            </motion.div>

            {/* Quick Actions — primary status + compact icon row */}
            <div className="space-y-2">
              <ReadingStatusButton bookId={book.id} className="w-full" />
              <div className="flex items-center gap-2">
                <Button
                  variant={isLiked ? 'default' : 'outline'}
                  size="icon"
                  aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
                  title={isLiked ? 'In wishlist' : 'Add to wishlist'}
                  className="shrink-0"
                  onClick={() => toggleWishlist(book)}
                >
                  <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                </Button>
                <TBRQueueButton bookId={book.id} className="flex-1" />
                <AddToListButton bookId={book.id} bookTitle={book.title} className="flex-1" />
              </div>
            </div>

            {/* Private personal tags */}
            <TagManager bookId={book.slug || book.id} />

            {/* Progress tracker for currently-reading books */}
            <ProgressTracker bookId={book.id} totalPages={book.pageCount} />

            {/* Owned books tracking */}
            <OwnedBookButton bookId={book.id} />

            {/* Social Sharing */}
            <SocialShare
              url={`${window.location.origin}/book/${book.slug}`}
              title={`${book.title} by ${book.author}`}
              description={book.description?.slice(0, 200)}
              variant="icons"
            />

            {/* Affiliate Links */}
            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <h3 className="font-semibold text-sm">Buy This Book</h3>
              {book.price && (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary">{formatPrice(book.price, book.currency)}</span>
                </div>
              )}
              {book.amazonUrl ? (() => {
                const isDirectLink = book.amazonUrl!.includes('/dp/');
                const searchFallbackUrl = `https://www.amazon.com/s?k=${encodeURIComponent(book.isbn13 || book.isbn10 || `${book.title} ${book.author}`)}&tag=thebooktimes-20`;
                return (
                  <>
                    <Button className="w-full gap-2" size="lg" asChild>
                      <a href={book.amazonUrl} target="_blank" rel="nofollow sponsored noopener noreferrer" onClick={handleAffiliateClick}>
                        {isDirectLink ? (
                          <ShoppingCart className="h-4 w-4" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        {isDirectLink ? 'Buy on Amazon' : 'Find on Amazon'}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    {isDirectLink && (
                      <a
                        href={searchFallbackUrl}
                        target="_blank"
                        rel="nofollow sponsored noopener noreferrer"
                        className="block text-[11px] text-center text-muted-foreground hover:text-primary transition-colors"
                        onClick={handleAffiliateClick}
                      >
                        Not finding the book? Search on Amazon instead
                      </a>
                    )}
                    <p className="text-[11px] text-center text-muted-foreground">
                      Affiliate link — we may earn a commission
                    </p>
                  </>
                );
              })() : (
                <Button className="w-full gap-2" size="lg" variant="secondary" disabled>
                  <ShoppingCart className="h-4 w-4" />
                  Coming Soon
                </Button>
              )}
              {book.goodreadsUrl && (
                <Button className="w-full gap-2" variant="outline" asChild>
                  <a href={book.goodreadsUrl} target="_blank" rel="noopener noreferrer">
                    <BookOpen className="h-4 w-4" />
                    View on Goodreads
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              {book.customLinkUrl && book.customLinkLabel && (
                <Button className="w-full gap-2" variant="outline" asChild>
                  <a href={book.customLinkUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    {book.customLinkLabel}
                  </a>
                </Button>
              )}
            </div>

            {/* Book Details Card */}
            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <h3 className="font-semibold text-sm">Book Details</h3>
              <div className="grid gap-3 text-sm">
                {book.publisher && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Publisher:</span>
                    <span className="font-medium">{book.publisher}</span>
                  </div>
                )}
                {book.publishedDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Published:</span>
                    <span className="font-medium">{formatDate(book.publishedDate)}</span>
                  </div>
                )}
                {book.pageCount && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Pages:</span>
                    <span className="font-medium">{book.pageCount}</span>
                  </div>
                )}
                {book.pageCount && book.pageCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Reading time:</span>
                    <span className="font-medium">~{Math.max(1, Math.round(book.pageCount * 1.7 / 60))} hours</span>
                  </div>
                )}
                {book.isbn13 && (
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">ISBN-13:</span>
                    <span className="font-medium">{book.isbn13}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Language:</span>
                  <span className="font-medium">{book.language.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Editions Browser */}
            <EditionsBrowser bookId={book.id} />

          </div>

          {/* RIGHT COLUMN â€” Description, Ratings, Reviews */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-8"
          >
            {/* Header */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                {book.categories.map((cat) => (
                  <Link key={cat} to={`/category/${cat.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 transition-colors">{cat}</Badge>
                  </Link>
                ))}
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold">{book.title}</h1>
              {book.subtitle && (
                <p className="text-xl text-muted-foreground mt-1">{book.subtitle}</p>
              )}
              <p className="text-lg mt-2">
                by {book.authorsData && book.authorsData.length > 0 ? (
                  book.authorsData.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 && ', '}
                      <Link to={`/author/${a.slug}`} className="font-medium text-primary hover:underline">
                        {a.name}
                      </Link>
                    </span>
                  ))
                ) : book.authorData?.slug ? (
                  <Link to={`/author/${book.authorData.slug}`} className="font-medium text-primary hover:underline">
                    {book.author}
                  </Link>
                ) : (
                  <span className="font-medium text-primary">{book.author}</span>
                )}
              </p>
              {book.series && book.series.length > 0 && (
                <div className="mt-3">
                  <SeriesBadge series={book.series} />
                </div>
              )}
              {/* Mood Tags */}
              <div className="mt-4">
                <MoodTags bookId={book.id} />
              </div>
              {/* Pace Indicator */}
              <div className="mt-4">
                <PaceIndicator bookId={book.id} />
              </div>
            </div>

            {/* Rating Bar */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-2">
                <StarDisplay rating={book.googleRating || 0} size="md" />
                <span className="text-xl sm:text-2xl font-bold">{formatRating(book.googleRating)}</span>
              </div>
              <Separator orientation="vertical" className="h-8 hidden sm:block" />
              <span className="text-sm sm:text-base text-muted-foreground">{formatNumber(book.ratingsCount)} ratings</span>
              <Separator orientation="vertical" className="h-8 hidden sm:block" />
              <span className="text-sm sm:text-base text-muted-foreground">Score: {book.computedScore.toFixed(1)}</span>
              <Separator orientation="vertical" className="h-8 hidden sm:block" />
              <InlineRatingWidget bookSlug={book.slug} userRating={book.userRating} />
            </div>

            {/* Reading Counts */}
            <ReadingCounts bookId={book.id} />

            {/* Friends reading this */}
            <FriendsReadingThis bookId={book.id} />

            {/* Content Warnings (collapsed by default) */}
            <ContentWarnings bookId={book.id} />

            {/* Story arc visualization */}
            <StoryArcChart bookId={book.id} />

            {/* AI insights */}
            <AIInsights bookId={book.id} />

            {/* Characters */}
            <CharactersList bookId={book.id} />

            {/* Description */}
            <DescriptionSection description={book.description} />

            <Separator />

            {/* About the Author */}
            {book.authorsData && book.authorsData.length > 0 && (
              <>
                <AuthorSection authors={book.authorsData} />
                <Separator />
              </>
            )}

            {/* Recommendations (moved above reviews for better engagement) */}
            <BookRecommendations bookId={book.id} />

            {/* Featured in blog cross-links */}
            <FeaturedInBlog bookId={book.id} />

            <Separator />

            {/* Memorable Quotes */}
            <BookQuotes bookId={book.id} />

            <Separator />

            {/* Personal reading journal */}
            <ReadingJournal bookId={book.id} />

            <Separator />

            {/* Quizzes & Trivia */}
            <BookQuizzes bookId={book.id} />

            <Separator />

            {/* Discussion forums */}
            <BookDiscussions bookId={book.id} />

            <Separator />

            {/* Community prompts */}
            <CommunityPrompts bookId={book.id} />

            <Separator />

            {/* Reviews */}
            <div>
              <BookReviews bookId={book.id} />
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

const DESCRIPTION_CHAR_LIMIT = 500;

function DescriptionSection({ description }: { description?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const text = description || 'No description available.';
  const isLong = text.length > DESCRIPTION_CHAR_LIMIT;
  const displayText = isLong && !isExpanded ? text.slice(0, DESCRIPTION_CHAR_LIMIT) + '...' : text;

  return (
    <div>
      <h2 className="text-xl font-bold mb-3">About This Book</h2>
      <p className="text-muted-foreground leading-relaxed text-[15px]">
        {displayText}
      </p>
      {isLong && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-primary gap-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show less' : 'Read more'}
          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </Button>
      )}
    </div>
  );
}
