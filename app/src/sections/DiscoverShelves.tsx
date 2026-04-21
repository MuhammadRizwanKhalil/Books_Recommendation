import { lazy, Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Star, Clock } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const NewReleases = lazy(() => import('@/sections/NewReleases').then((m) => ({ default: m.NewReleases })));
const TopRated = lazy(() => import('@/sections/TopRated').then((m) => ({ default: m.TopRated })));

function ShelfFallback() {
  return (
    <div className="flex items-center justify-center py-16" aria-hidden="true">
      <div className="h-6 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}

/**
 * DiscoverShelves — unified, tabbed wrapper around the existing
 * New Releases and Top Rated sections so they no longer feel duplicate.
 * Each tab renders its respective component fully (own carousel/podium).
 */
export function DiscoverShelves() {
  const [tab, setTab] = useState<'new' | 'top'>('new');

  return (
    <section
      id="discover-shelves"
      aria-labelledby="discover-shelves-title"
      className="py-12 sm:py-16"
    >
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary/80 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Curated Picks
            </p>
            <h2
              id="discover-shelves-title"
              className="mt-1 font-serif text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight"
            >
              Fresh shelves to explore
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Brand-new releases and reader-loved classics — switch between the two.
            </p>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as 'new' | 'top')} className="self-start sm:self-auto">
            <TabsList className="h-10 rounded-full bg-muted p-1">
              <TabsTrigger value="new" className="rounded-full px-4 text-sm font-medium gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                New Releases
              </TabsTrigger>
              <TabsTrigger value="top" className="rounded-full px-4 text-sm font-medium gap-1.5">
                <Star className="h-3.5 w-3.5" />
                Top Rated
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        <div className="rounded-3xl border border-border/50 bg-card/40 backdrop-blur-sm">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'new' | 'top')}>
            <TabsContent value="new" className="m-0">
              <Suspense fallback={<ShelfFallback />}>
                <NewReleases />
              </Suspense>
            </TabsContent>
            <TabsContent value="top" className="m-0">
              <Suspense fallback={<ShelfFallback />}>
                <TopRated />
              </Suspense>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  );
}
