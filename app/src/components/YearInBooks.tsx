import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Download, Share2, Sparkles, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { yearInBooksApi, type YearInBooksResponse } from '@/api/client';
import { useSEO } from '@/hooks/useSEO';

export function YearInBooks() {
  const { year } = useParams<{ year: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, openAuthModal } = useAuth();

  const currentYear = new Date().getFullYear();
  const routeYear = Number.parseInt(year || `${currentYear}`, 10);
  const selectedYear = Number.isFinite(routeYear) ? routeYear : currentYear;
  const selectableYears = useMemo(() => [currentYear, currentYear - 1, currentYear - 2, currentYear - 3], [currentYear]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<YearInBooksResponse | null>(null);

  useSEO({
    title: `${selectedYear} Year in Books | The Book Times`,
    description: `See your ${selectedYear} reading recap with books, pages, genres, streaks, and top-rated picks.`,
    ogTitle: `${selectedYear} Year in Books | The Book Times`,
  });

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    yearInBooksApi
      .get(user.id, selectedYear)
      .then((res) => setData(res))
      .catch((err: any) => {
        setError(err?.message || 'Failed to load Year in Books');
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, user?.id, selectedYear]);

  const shareUrl = window.location.href;

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied');
    } catch {
      toast.error('Could not copy link');
    }
  }

  function shareToTwitter() {
    const text = `My ${selectedYear} Year in Books: ${data?.totalBooks || 0} books and ${data?.totalPages || 0} pages on The Book Times.`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function downloadShareImage() {
    if (!user?.id) return;
    const imageUrl = yearInBooksApi.getShareImageUrl(user.id, selectedYear);
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `year-in-books-${selectedYear}.png`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error('Could not download share image');
    }
  }

  if (!isAuthenticated && !isLoading) {
    return (
      <div>
        <div className="container mx-auto px-4 py-20 text-center" data-testid="year-in-books-auth-required">
          <h1 className="text-3xl font-semibold">Year in Books</h1>
          <p className="mt-3 text-muted-foreground">Sign in to see your reading recap.</p>
          <Button className="mt-6" onClick={() => openAuthModal('signin')}>
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  if (loading || isLoading) {
    return (
      <div>
        <div className="container mx-auto px-4 py-20 flex justify-center">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="container mx-auto px-4 py-20 text-center" data-testid="year-in-books-error">
          <h1 className="text-2xl font-semibold">Year in Books unavailable</h1>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasData = data.totalBooks > 0;

  return (
    <div>
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6" data-testid="year-in-books-page">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border bg-card p-6"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Sparkles className="h-7 w-7 text-primary" />
                Year in Books {selectedYear}
              </h1>
              <p className="text-muted-foreground mt-2">Your annual reading recap.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Select
                value={String(selectedYear)}
                onValueChange={(value) => navigate(`/year-in-books/${value}`)}
              >
                <SelectTrigger className="w-[170px]" aria-label="Select recap year" data-testid="year-in-books-selector">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {selectableYears.map((yr) => (
                    <SelectItem key={yr} value={String(yr)}>
                      {yr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={copyShareLink} data-testid="year-in-books-share-link">
                <Share2 className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
              <Button variant="outline" onClick={shareToTwitter} data-testid="year-in-books-share-twitter">
                Share
              </Button>
              <Button variant="outline" onClick={downloadShareImage} data-testid="year-in-books-download-image">
                <Download className="h-4 w-4 mr-2" />
                Image
              </Button>
            </div>
          </div>
        </motion.section>

        {!hasData && (
          <Card data-testid="year-in-books-empty-state">
            <CardContent className="py-12 text-center">
              <h2 className="text-2xl font-semibold">Start reading to see your recap</h2>
              <p className="text-muted-foreground mt-2">Mark books as finished in {selectedYear} to generate your Year in Books.</p>
            </CardContent>
          </Card>
        )}

        {hasData && (
          <>
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <Card data-testid="year-in-books-total-books"><CardContent className="py-5"><p className="text-sm text-muted-foreground">Books</p><p className="text-3xl font-bold">{data.totalBooks}</p></CardContent></Card>
              <Card data-testid="year-in-books-total-pages"><CardContent className="py-5"><p className="text-sm text-muted-foreground">Pages</p><p className="text-3xl font-bold">{data.totalPages.toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="py-5"><p className="text-sm text-muted-foreground">Avg rating</p><p className="text-3xl font-bold">{data.averageRating.toFixed(1)}</p></CardContent></Card>
              <Card><CardContent className="py-5"><p className="text-sm text-muted-foreground">Longest streak</p><p className="text-3xl font-bold">{data.readingStreak.longest}</p></CardContent></Card>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
              className="grid lg:grid-cols-2 gap-4"
            >
              <Card data-testid="year-in-books-genre-chart">
                <CardHeader><CardTitle>Genre Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <p className="sr-only">Genre breakdown chart of your reading by category.</p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.genreBreakdown} accessibilityLayer={false} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="genre" width={110} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#22c55e" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="year-in-books-monthly-chart">
                <CardHeader><CardTitle>Monthly Pace</CardTitle></CardHeader>
                <CardContent>
                  <p className="sr-only">Monthly bar chart showing how many books you finished each month.</p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.monthlyBreakdown} accessibilityLayer={false}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="booksRead" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
              className="grid md:grid-cols-2 gap-4"
            >
              <Card data-testid="year-in-books-shortest-book">
                <CardHeader><CardTitle>Shortest Book</CardTitle></CardHeader>
                <CardContent>
                  {data.shortestBook ? (
                    <div>
                      <p className="font-medium">{data.shortestBook.title}</p>
                      <p className="text-muted-foreground">{data.shortestBook.pages} pages</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No page-count data available.</p>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="year-in-books-longest-book">
                <CardHeader><CardTitle>Longest Book</CardTitle></CardHeader>
                <CardContent>
                  {data.longestBook ? (
                    <div>
                      <p className="font-medium">{data.longestBook.title}</p>
                      <p className="text-muted-foreground">{data.longestBook.pages} pages</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No page-count data available.</p>
                  )}
                </CardContent>
              </Card>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
            >
              <Card data-testid="year-in-books-top-rated-books">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Top Rated Books
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topRatedBooks.length === 0 ? (
                    <p className="text-muted-foreground">Add ratings to see your favorites.</p>
                  ) : (
                    <ul className="space-y-3">
                      {data.topRatedBooks.map((book, index) => (
                        <li key={`${book.slug}-${index}`} className="flex items-center justify-between border rounded-lg px-3 py-2" data-testid="year-in-books-top-rated-item">
                          <div>
                            <p className="font-medium">{book.title}</p>
                            <p className="text-xs text-muted-foreground">{book.slug}</p>
                          </div>
                          <p className="font-semibold">{book.rating.toFixed(1)} ★</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </motion.section>
          </>
        )}
      </div>
    </div>
  );
}
