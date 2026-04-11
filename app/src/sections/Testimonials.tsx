import { useState, useEffect } from 'react';
import { Star, Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    <section id="testimonials" className="py-12 sm:py-16 md:py-24 bg-muted/40">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="text-center max-w-2xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="default" className="mb-4">
            <Star className="w-3 h-3 mr-1 fill-current" />
            What Readers Say
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold font-serif mb-4">
            Loved by Book Enthusiasts
          </h2>
          <p className="text-muted-foreground">
            Join thousands of readers who have discovered their next favorite book through our
            smart recommendation engine.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardContent className="p-6 flex flex-col h-full">
                  <Quote className="h-8 w-8 text-primary/30 mb-4" />
                  <p className="text-muted-foreground flex-1 mb-6 leading-relaxed italic">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      className="w-10 h-10 rounded-full object-cover"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Stats Bar */}
        <motion.div
          className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6"
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
            <div key={stat.label} className="text-center p-4 rounded-xl bg-muted/50">
              <p className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
