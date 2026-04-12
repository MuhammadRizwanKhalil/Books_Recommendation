import { TrendingUp } from 'lucide-react';
import { useTopRated } from '@/hooks/useBooks';
import { BookCarousel } from '@/components/BookCarousel';

export function Top20Carousel() {
  const { books, loading } = useTopRated(20);

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4">
        <BookCarousel
          books={books}
          title="Top 20 Books"
          subtitle="Highest rated across all categories"
          loading={loading}
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
        />
      </div>
    </section>
  );
}
