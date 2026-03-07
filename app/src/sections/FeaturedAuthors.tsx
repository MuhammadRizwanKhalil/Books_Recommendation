import { useState, useEffect } from 'react';
import { Star, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { booksApi } from '@/api/client';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

type AuthorData = {
  id: string;
  name: string;
  slug: string;
  bookCount: number;
  avgRating: number;
  topCover: string;
  imageUrl?: string;
  specialties: string[];
};

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
  'bg-teal-500', 'bg-orange-500', 'bg-fuchsia-500', 'bg-lime-500',
];

export function FeaturedAuthors() {
  const [authors, setAuthors] = useState<AuthorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    booksApi.authors(12)
      .then(setAuthors)
      .catch(() => setAuthors([]))
      .finally(() => setLoading(false));
  }, []);
  return (
    <section id="authors" className="py-12 sm:py-16 md:py-24">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="space-y-2">
            <Badge variant="default" className="bg-indigo-500">
              <Users className="w-3 h-3 mr-1" />
              Featured Writers
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold font-serif flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              Featured Authors
            </h2>
            <p className="text-muted-foreground max-w-xl">
              Explore books from today&rsquo;s most influential authors. From self-help gurus to
              acclaimed historians, discover the minds behind the bestsellers.
            </p>
          </div>
        </motion.div>

        {/* Authors Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {loading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <Card key={i} className="text-center">
                <CardContent className="p-6 space-y-3 flex flex-col items-center">
                  <Skeleton className="w-20 h-20 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))
          ) : authors.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground py-12">No authors found yet.</p>
          ) : (
            authors.map((author, index) => (
              <motion.div
                key={author.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Link to={`/author/${author.slug}`}>
                <Card className="group cursor-pointer text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-transparent hover:border-primary/20">
                  <CardContent className="p-5">
                    <div className="relative mx-auto w-20 h-20 mb-4">
                      {author.imageUrl || author.topCover ? (
                        <img
                          src={author.imageUrl || author.topCover}
                          alt={author.name}
                          className="w-full h-full rounded-full object-cover ring-2 ring-border group-hover:ring-primary/60 transition-all shadow-sm"
                        />
                      ) : (
                        <div className={`w-full h-full rounded-full ${COLORS[index % COLORS.length]} flex items-center justify-center text-white text-xl font-bold ring-2 ring-border group-hover:ring-primary/60 transition-all`}>
                          {getInitials(author.name)}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
                        {author.bookCount}
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                      {author.name}
                    </h3>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium">{author.avgRating.toFixed(1)}</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-1 mt-2">
                      {author.specialties.slice(0, 2).map((s) => (
                        <span key={s} className="text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                          {s}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
