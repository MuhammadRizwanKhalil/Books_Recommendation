import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { aiMoodApi, moodApi, type MoodItem, type MoodDiscoverResponse } from '@/api/client';
import { useSEO } from '@/hooks/useSEO';
import { getOptimizedImageUrl } from '@/lib/imageUtils';

interface MoodDiscoveryPageProps {
  initialSlug?: string;
  onBack: () => void;
}

export function MoodDiscoveryPage({ initialSlug, onBack }: MoodDiscoveryPageProps) {
  const [allMoods, setAllMoods] = useState<MoodItem[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(initialSlug || null);
  const [selectedPace, setSelectedPace] = useState<'slow' | 'medium' | 'fast' | null>(null);
  const [discoverData, setDiscoverData] = useState<MoodDiscoverResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useSEO({
    title: selectedMood
      ? `${discoverData?.mood?.name || selectedMood} Books — TheBookTimes`
      : 'Discover Books by Mood — TheBookTimes',
    description: selectedMood
      ? `Browse books tagged as ${discoverData?.mood?.name || selectedMood} by the community.`
      : 'What mood are you in? Discover books based on how they make you feel.',
  });

  // Load all moods
  useEffect(() => {
    moodApi.getAll().then(setAllMoods).catch(() => { /* silent */ });
  }, []);

  // Load books when a mood is selected
  const loadBooks = useCallback(async (slug: string, pageNum: number, pace: 'slow' | 'medium' | 'fast' | null) => {
    setLoading(true);
    try {
      const aiResult = await aiMoodApi.discoverByMood({
        mood: slug,
        pace: pace || undefined,
        page: pageNum,
      });

      const mapped: MoodDiscoverResponse = {
        mood: allMoods.find((m) => m.slug === slug) || {
          id: slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1),
          slug,
          emoji: '✨',
          color: '#64748B',
        },
        books: aiResult.books.map((book) => ({
          id: book.id,
          title: book.title,
          slug: book.slug,
          author: book.author,
          coverImage: book.coverImage,
          googleRating: book.googleRating,
          computedScore: book.computedScore,
          pageCount: book.pageCount,
          publishedDate: book.publishedDate,
          description: null,
          moodVotes: Math.round((book.aiMood.confidence || 0) * 100),
        })),
        pagination: aiResult.pagination,
      };

      setDiscoverData(mapped);
    } catch {
      try {
        const fallbackResult = await moodApi.discoverByMood(slug, pageNum);
        setDiscoverData(fallbackResult);
      } catch {
        setDiscoverData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [allMoods]);

  useEffect(() => {
    if (selectedMood) {
      loadBooks(selectedMood, page, selectedPace);
    }
  }, [selectedMood, selectedPace, page, loadBooks]);

  const handleMoodClick = useCallback((slug: string) => {
    setSelectedMood(slug);
    setPage(1);
  }, []);

  const handlePaceClick = useCallback((pace: 'slow' | 'medium' | 'fast') => {
    setSelectedPace((prev) => (prev === pace ? null : pace));
    setPage(1);
  }, []);

  const handleBack = useCallback(() => {
    if (selectedMood) {
      setSelectedMood(null);
      setSelectedPace(null);
      setDiscoverData(null);
      setPage(1);
    } else {
      onBack();
    }
  }, [selectedMood, onBack]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl" data-testid="mood-discovery-page">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {selectedMood && discoverData?.mood
              ? `${discoverData.mood.emoji} ${discoverData.mood.name} Books`
              : 'What mood are you in?'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {selectedMood
              ? `${discoverData?.pagination?.total || 0} books match this mood`
              : 'Discover books based on how they make you feel'}
          </p>
        </div>
      </div>

      {/* Mood Grid — always show for multi-mood navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8" data-testid="mood-grid">
        {allMoods.map((mood) => (
          <motion.button
            key={mood.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleMoodClick(mood.slug)}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all
              ${selectedMood === mood.slug
                ? 'border-primary bg-primary/10 shadow-md'
                : 'border-border hover:border-muted-foreground/50 hover:shadow-sm'
              }`}
            style={{
              borderColor: selectedMood === mood.slug ? mood.color : undefined,
              backgroundColor: selectedMood === mood.slug ? `${mood.color}15` : undefined,
            }}
            data-testid={`mood-card-${mood.slug}`}
          >
            <span className="text-3xl" aria-hidden="true">{mood.emoji}</span>
            <span className="text-sm font-medium">{mood.name}</span>
          </motion.button>
        ))}
      </div>

      <div className="mb-8" data-testid="mood-pace-filter">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Filter by pace (AI-detected)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['slow', 'medium', 'fast'] as const).map((pace) => (
            <Button
              key={pace}
              size="sm"
              variant={selectedPace === pace ? 'default' : 'outline'}
              onClick={() => handlePaceClick(pace)}
              data-testid={`mood-pace-${pace}`}
              className="capitalize"
            >
              {pace}
            </Button>
          ))}
        </div>
      </div>

      {/* Book Results */}
      {selectedMood && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : discoverData && discoverData.books.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" data-testid="mood-book-grid">
                {discoverData.books.map((book) => (
                  <Link
                    key={book.id}
                    to={`/book/${book.slug}`}
                    className="group"
                    data-testid={`mood-book-${book.slug}`}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted shadow-sm group-hover:shadow-md transition-shadow">
                        <img
                          src={getOptimizedImageUrl(book.coverImage, 200)}
                          alt={book.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                          {book.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge variant="secondary" className="text-[10px]" data-testid="ai-detected-label">
                            AI-detected
                          </Badge>
                          <Badge variant="outline" className="text-[10px]" data-testid="mood-confidence-indicator">
                            Confidence: {Math.max(0, Math.min(100, Math.round((book.moodVotes || 0))))}%
                          </Badge>
                        </div>
                        {book.googleRating && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs text-muted-foreground">{book.googleRating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {discoverData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {discoverData.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= discoverData.pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No books found for this mood yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Be the first to vote on book moods!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
