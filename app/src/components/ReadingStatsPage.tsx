import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Flame, Star, FileText, TrendingUp, Users, Clock, Trophy,
  BarChart3, Share2, Zap, BookMarked,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/AuthProvider';
import { readingStatsApi, type ReadingStatsResponse } from '@/api/client';
import { StatsCard } from './StatsCard';
import { useSEO } from '@/hooks/useSEO';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff', '#818cf8', '#4f46e5', '#4338ca'];

const currentYear = new Date().getFullYear();
const YEAR_TABS = [currentYear - 2, currentYear - 1, currentYear, 'All Time'] as const;

export function ReadingStatsPage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ReadingStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(currentYear);

  useSEO({
    title: 'My Reading Stats - The Book Times',
    description: 'View your reading statistics — books per month, genre breakdown, rating distribution, reading pace, and more.',
    ogTitle: 'My Reading Stats - The Book Times',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    readingStatsApi.getMyStats(selectedYear ?? undefined)
      .then(setStats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isAuthenticated, selectedYear]);

  const handleShare = async () => {
    if (!stats) return;
    const text = `I've read ${stats.booksRead} books${selectedYear ? ` in ${selectedYear}` : ''}${stats.pagesRead > 0 ? ` (${stats.pagesRead.toLocaleString()} pages)` : ''} on The Book Times!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Reading Stats', text, url: window.location.href });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    }
  };

  // Unauthenticated
  if (!isAuthenticated) {
    return (
      <main className="pt-16">
        <div className="container mx-auto px-4 py-16 text-center space-y-4" data-testid="stats-auth-required">
          <BarChart3 className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-3xl font-bold">Reading Statistics</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Sign in to view your personalized reading stats and insights.
          </p>
          <Button onClick={() => openAuthModal('signin')} data-testid="stats-signin-btn">
            Sign In to View Stats
          </Button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="pt-16">
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="pt-16">
        <div className="container mx-auto px-4 py-16 text-center space-y-4" data-testid="stats-error">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">Could not load your reading statistics.</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </main>
    );
  }

  if (!stats) return null;

  const hasData = stats.booksRead > 0;

  return (
    <main className="pt-16">
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8" data-testid="reading-stats-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              Reading Statistics
            </h1>
            <p className="text-muted-foreground mt-1">Your reading habits at a glance</p>
          </div>
          {hasData && (
            <Button variant="outline" size="sm" onClick={handleShare} data-testid="share-stats-btn">
              <Share2 className="h-4 w-4 mr-1.5" />
              Share
            </Button>
          )}
        </div>

        {/* Year Selector */}
        <div className="flex flex-wrap gap-2" data-testid="year-selector" role="tablist" aria-label="Year filter">
          {YEAR_TABS.map((yr) => (
            // eslint-disable-next-line jsx-a11y/aria-proptypes
            <button
              key={String(yr)}
              role="tab"
              aria-selected={yr === 'All Time' ? selectedYear === null : selectedYear === yr}
              onClick={() => setSelectedYear(yr === 'All Time' ? null : (yr as number))}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                (yr === 'All Time' && selectedYear === null) || selectedYear === yr
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-accent'
              }`}
              data-testid={`year-tab-${yr === 'All Time' ? 'all' : yr}`}
            >
              {yr === 'All Time' ? 'All Time' : yr}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {!hasData && (
          <div className="text-center py-16 rounded-xl border bg-card" data-testid="stats-empty-state">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {selectedYear ? `No books read in ${selectedYear}` : 'No reading data yet'}
            </h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Start tracking your reading to see stats! Mark books as "Finished" to build your stats.
            </p>
          </div>
        )}

        {hasData && (
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="stats-summary-cards">
              <StatsCard
                icon={BookOpen}
                value={stats.booksRead}
                label="Books Read"
                color="text-green-600 bg-green-50 dark:bg-green-950"
                testId="stat-books-read"
              />
              <StatsCard
                icon={FileText}
                value={stats.pagesRead.toLocaleString()}
                label="Pages Read"
                color="text-blue-600 bg-blue-50 dark:bg-blue-950"
                testId="stat-pages-read"
              />
              <StatsCard
                icon={Star}
                value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—'}
                label="Avg Rating"
                color="text-amber-500 bg-amber-50 dark:bg-amber-950"
                testId="stat-avg-rating"
              />
              <StatsCard
                icon={Flame}
                value={stats.streak.currentDays}
                label="Day Streak"
                color="text-orange-500 bg-orange-50 dark:bg-orange-950"
                testId="stat-streak"
              />
            </div>

            {/* Books per Month chart */}
            {stats.booksPerMonth.length > 0 && (
              <Card data-testid="chart-books-per-month">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Books Per Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64" role="img" aria-label={`Books per month chart showing ${stats.booksPerMonth.length} months of data`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.booksPerMonth}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={(v: string) => {
                            const [, m] = v.split('-');
                            return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m) - 1] || m;
                          }}
                          className="text-xs"
                        />
                        <YAxis allowDecimals={false} className="text-xs" />
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                          labelFormatter={(v: string) => {
                            const [y, m] = v.split('-');
                            return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m) - 1]} ${y}`;
                          }}
                        />
                        <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Books" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Genre Distribution + Rating Distribution side by side */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Genre Pie Chart */}
              {stats.genreDistribution.length > 0 && (
                <Card data-testid="chart-genre-distribution">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookMarked className="h-4 w-4 text-primary" />
                      Genre Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64" role="img" aria-label={`Genre distribution: ${stats.genreDistribution.map(g => `${g.genre} ${g.percentage}%`).join(', ')}`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.genreDistribution}
                            dataKey="count"
                            nameKey="genre"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ genre, percentage }: { genre: string; percentage: number }) => `${genre} ${percentage}%`}
                          >
                            {stats.genreDistribution.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rating Bar Chart */}
              {stats.ratingDistribution.length > 0 && (
                <Card data-testid="chart-rating-distribution">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500" />
                      Rating Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64" role="img" aria-label={`Rating distribution: ${stats.ratingDistribution.map(r => `${r.rating} stars: ${r.count}`).join(', ')}`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.ratingDistribution}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="rating" tickFormatter={(v: number) => `${v}★`} className="text-xs" />
                          <YAxis allowDecimals={false} className="text-xs" />
                          <Tooltip
                            contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                            labelFormatter={(v: number) => `${v} Stars`}
                          />
                          <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Books" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Top Authors */}
            {stats.topAuthors.length > 0 && (
              <Card data-testid="top-authors-section">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Top Authors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.topAuthors.map((author, i) => (
                      <div key={author.name} className="flex items-center justify-between" data-testid="top-author-item">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}</span>
                          <span className="font-medium">{author.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{author.booksRead} book{author.booksRead > 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reading Pace + Streak Row */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Reading Pace */}
              <Card data-testid="reading-pace-section">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Reading Pace
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Avg. days per book</span>
                    <span className="font-semibold" data-testid="avg-days-per-book">{stats.readingPace.averageDaysPerBook || '—'}</span>
                  </div>
                  {stats.readingPace.fastestBook && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Fastest read</span>
                      <button
                        onClick={() => stats.readingPace.fastestBook?.slug && navigate(`/book/${stats.readingPace.fastestBook.slug}`)}
                        className="text-sm font-medium text-primary hover:underline text-right max-w-[60%] truncate"
                      >
                        {stats.readingPace.fastestBook.title} ({stats.readingPace.fastestBook.days}d)
                      </button>
                    </div>
                  )}
                  {stats.readingPace.slowestBook && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Slowest read</span>
                      <button
                        onClick={() => stats.readingPace.slowestBook?.slug && navigate(`/book/${stats.readingPace.slowestBook.slug}`)}
                        className="text-sm font-medium text-primary hover:underline text-right max-w-[60%] truncate"
                      >
                        {stats.readingPace.slowestBook.title} ({stats.readingPace.slowestBook.days}d)
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Streaks */}
              <Card data-testid="streak-section">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Reading Streak
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Current streak</span>
                    <span className="font-semibold flex items-center gap-1" data-testid="current-streak">
                      <Flame className="h-4 w-4 text-orange-500" />
                      {stats.streak.currentDays} day{stats.streak.currentDays !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Longest streak</span>
                    <span className="font-semibold flex items-center gap-1" data-testid="longest-streak">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      {stats.streak.longestDays} day{stats.streak.longestDays !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {stats.streak.lastReadingDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last activity</span>
                      <span className="text-sm">{new Date(stats.streak.lastReadingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Shortest / Longest books */}
            {(stats.shortestBook || stats.longestBook) && (
              <div className="grid md:grid-cols-2 gap-6">
                {stats.shortestBook && (
                  <Card data-testid="shortest-book-card">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-muted-foreground">Shortest Book</span>
                      </div>
                      <button
                        onClick={() => stats.shortestBook?.slug && navigate(`/book/${stats.shortestBook.slug}`)}
                        className="font-semibold hover:text-primary transition-colors text-left"
                      >
                        {stats.shortestBook.title}
                      </button>
                      <p className="text-sm text-muted-foreground">{stats.shortestBook.pageCount} pages</p>
                    </CardContent>
                  </Card>
                )}
                {stats.longestBook && (
                  <Card data-testid="longest-book-card">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium text-muted-foreground">Longest Book</span>
                      </div>
                      <button
                        onClick={() => stats.longestBook?.slug && navigate(`/book/${stats.longestBook.slug}`)}
                        className="font-semibold hover:text-primary transition-colors text-left"
                      >
                        {stats.longestBook.title}
                      </button>
                      <p className="text-sm text-muted-foreground">{stats.longestBook.pageCount} pages</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </main>
  );
}
