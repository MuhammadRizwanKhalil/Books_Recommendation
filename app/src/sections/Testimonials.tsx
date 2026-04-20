import { useState, useEffect } from 'react';
import { Star, Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

import { testimonialsApi } from '@/api/client';
import type { TestimonialResponse } from '@/api/client';
import { usePublicStats } from '@/hooks/useBooks';
import { motion } from 'framer-motion';

export function Testimonials() {
  const { stats } = usePublicStats();
  const [testimonials, setTestimonials] = useState<Array<{ id: string; name: string; role: string; text: string; avatar: string; rating: number }>>([]);
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K+` : `${n}+`;

  useEffect(() => {
    testimonialsApi.list()
      .then((res) => {
        setTestimonials(res.testimonials.map((t: TestimonialResponse) => ({
            id: t.id,
            name: t.name,
            role: t.role,
            text: t.content,
            avatar: t.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(t.name)}`,
            rating: t.rating,
          })));
      })
      .catch(() => setTestimonials([]));
  }, []);

  return (
    <section id="testimonials" className="py-12 md:py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Loved by Readers</h2>
          <p className="text-muted-foreground">Join thousands who've discovered their next favorite book through our platform.</p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-0 shadow-md">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <Quote className="h-8 w-8 text-primary/20" />
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < testimonial.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-muted-foreground flex-1 mb-6 leading-relaxed italic text-sm">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-border shadow-sm"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Stats Bar */}
        <motion.div
          className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {[
            { label: 'Total Reviews', value: stats ? fmt(stats.totalReviews) : '...' },
            { label: 'Books Indexed', value: stats ? fmt(stats.totalBooks) : '...' },
            { label: 'Authors', value: stats ? fmt(stats.totalAuthors) : '...' },
            { label: 'Avg Rating', value: stats ? `${stats.avgRating}/5` : '...' },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-5 rounded-xl bg-card border shadow-sm hover:shadow-md transition-shadow">
              <p className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
