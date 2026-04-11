/**
 * For You — Personalized Recommendations Page
 * Uses hybrid ML recommendation engine (collaborative + content-based filtering)
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Brain, TrendingUp, Users, BookOpen } from 'lucide-react';
import { personalizedApi } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/AuthProvider';
import type { BookResponse } from '@/api/client';

const strategyIcons: Record<string, { icon: typeof Brain; label: string; color: string }> = {
  collaborative_filtering: { icon: Users, label: 'Based on Similar Readers', color: 'bg-blue-100 text-blue-800' },
  content_based: { icon: BookOpen, label: 'Based on Your Taste', color: 'bg-green-100 text-green-800' },
  popularity: { icon: TrendingUp, label: 'Popular Picks', color: 'bg-orange-100 text-orange-800' },
};

export function ForYouPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState<BookResponse[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    personalizedApi.forYou(18)
      .then(data => {
        setBooks(data.books);
        setStrategies(data.strategies);
        setConfidence(data.confidence);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Sparkles className="h-16 w-16 mx-auto text-primary mb-4" />
        <h1 className="text-3xl font-bold mb-2">Personalized For You</h1>
        <p className="text-muted-foreground mb-6">Sign in to get personalized book recommendations tailored to your reading taste.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Recommended For You</h1>
      </div>

      {/* Confidence indicator */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Brain className="h-4 w-4" />
          Confidence: {Math.round(confidence * 100)}%
          <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${confidence * 100}%` }} />
          </div>
        </div>
        {strategies.map(s => {
          const info = strategyIcons[s];
          if (!info) return null;
          const Icon = info.icon;
          return (
            <Badge key={s} variant="secondary" className={info.color}>
              <Icon className="h-3 w-3 mr-1" />
              {info.label}
            </Badge>
          );
        })}
      </div>

      {confidence < 0.3 && (
        <div className="bg-muted/50 border rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Rate more books and add reviews to improve your recommendations.
            The more you interact, the better we can personalize your experience!
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-48 w-full mb-2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2 mt-1" /></CardContent></Card>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground">Start exploring books to get personalized recommendations!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {books.map(book => (
            <Link key={book.id} to={`/book/${book.slug || book.id}`} className="block group">
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardContent className="p-3">
                  {book.coverImage ? (
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      className="w-full h-48 object-cover rounded mb-2 group-hover:scale-[1.02] transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted rounded mb-2 flex items-center justify-center text-muted-foreground">
                      <BookOpen className="h-8 w-8" />
                    </div>
                  )}
                  <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">{book.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{book.author}</p>
                  {book.googleRating && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-yellow-500 text-xs">★</span>
                      <span className="text-xs text-muted-foreground">{Number(book.googleRating).toFixed(1)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
