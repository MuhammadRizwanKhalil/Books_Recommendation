import { useState, useEffect, useCallback, lazy, Suspense, createContext, useContext } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ScrollToTop } from '@/components/ScrollToTop';
import { BackToTop } from '@/components/BackToTop';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthModal } from '@/components/AuthModal';
import { CategoryPage } from '@/components/CategoryPage';
import { BookPage } from '@/components/book/BookPage';
import { AuthorPage } from '@/components/AuthorPage';
import { AuthorPortal } from '@/components/AuthorPortal';
import { SeriesPage } from '@/components/SeriesPage';
import { MoodDiscoveryPage } from '@/components/MoodDiscoveryPage';
import { ReadingChallengePage } from '@/components/ReadingChallenge';
import { ReadingStatsPage } from '@/components/ReadingStatsPage';
import { YearInBooks } from '@/components/YearInBooks';
import { ImportGoodreadsPage } from '@/components/ImportGoodreadsPage';
import { ReadingListsPage, ReadingListDetailPage, PublicReadingListPage } from '@/components/ReadingListsPage';
import { ListDiscoveryPage } from '@/components/ListDiscoveryPage';
import { CommunityListPage } from '@/components/CommunityListPage';
import { BookComparePage } from '@/components/BookComparePage';
import { TBRQueuePage } from '@/components/TBRQueue';
import { PublicUserProfilePage } from '@/components/PublicUserProfilePage';
import { ForYouPage } from '@/components/ForYouPage';
import { ActivityFeed } from '@/components/ActivityFeed';
import { DiscussionThread } from '@/components/DiscussionThread';
import { BookClubsPage } from '@/components/BookClubsPage';
import { BookClubDetail } from '@/components/BookClubDetail';
import { GiveawaysPage } from '@/components/GiveawaysPage';
import { GiveawayDetailPage } from '@/components/GiveawayDetailPage';
import { MyGiveawayEntriesPage } from '@/components/MyGiveawayEntriesPage';
import { OwnedBooksPage } from '@/components/OwnedBooksPage';
import { TagsPage } from '@/components/TagsPage';
import { ChoiceAwardsPage } from '@/components/ChoiceAwardsPage';
import { JournalPage } from '@/components/JournalPage';
import { QuizPage } from '@/components/QuizPage';
import { QuizzesDiscoverPage } from '@/components/QuizzesDiscoverPage';
import { QuizCreatePage } from '@/components/QuizCreatePage';
import { PricingPage } from '@/components/PricingPage';
import { DigestSettingsPage } from '@/components/DigestSettingsPage';
import { WebhooksPage } from '@/components/WebhooksPage';
import { SearchPage } from '@/components/SearchPage';
import { BlogPage } from '@/components/BlogPage';
import { BlogPostPage } from '@/components/BlogPostPage';
import { TrendingPage } from '@/components/TrendingPage';
import { CategoriesPage } from '@/components/CategoriesPage';
import { GenreOnboardingModal } from '@/components/GenreOnboardingModal';
import { Navigation } from '@/sections/Navigation';
import { HeroV2 } from '@/sections/HeroV2';
import { Footer } from '@/sections/Footer';

// â”€â”€ Lazy-loaded below-fold sections (reduces initial bundle) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const QuickDiscoverBar = lazy(() => import('@/sections/QuickDiscoverBar').then(m => ({ default: m.QuickDiscoverBar })));
const PersonalDashboard = lazy(() => import('@/sections/PersonalDashboard').then(m => ({ default: m.PersonalDashboard })));
const Trending = lazy(() => import('@/sections/Trending').then(m => ({ default: m.Trending })));
const Categories = lazy(() => import('@/sections/Categories').then(m => ({ default: m.Categories })));
const DiscoverShelves = lazy(() => import('@/sections/DiscoverShelves').then(m => ({ default: m.DiscoverShelves })));
const FeatureHub = lazy(() => import('@/sections/FeatureHub').then(m => ({ default: m.FeatureHub })));
const Testimonials = lazy(() => import('@/sections/Testimonials').then(m => ({ default: m.Testimonials })));
const FeaturedAuthors = lazy(() => import('@/sections/FeaturedAuthors').then(m => ({ default: m.FeaturedAuthors })));
const BlogStrip = lazy(() => import('@/sections/BlogStrip').then(m => ({ default: m.BlogStrip })));
const Newsletter = lazy(() => import('@/sections/Newsletter').then(m => ({ default: m.Newsletter })));
const BookOfTheDay = lazy(() => import('@/sections/BookOfTheDay').then(m => ({ default: m.BookOfTheDay })));
const PopularSearches = lazy(() => import('@/sections/PopularSearches').then(m => ({ default: m.PopularSearches })));
const Top20Carousel = lazy(() => import('@/sections/Top20Carousel').then(m => ({ default: m.Top20Carousel })));
import type { AdminPage } from '@/admin/AdminLayout';
import { LegalPage } from '@/components/LegalPage';
import { AdminBar } from '@/components/AdminBar';
import { WishlistDrawer } from '@/components/WishlistDrawer';
import { useAuth } from '@/components/AuthProvider';
import { ApiError, booksApi, settingsApi } from '@/api/client';
import { mapBook } from '@/lib/mappers';
import type { Book, Category } from '@/types';
import { useSEO } from '@/hooks/useSEO';
import './App.css';

// â”€â”€ Lazy-loaded admin components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AdminLayout = lazy(() => import('@/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminLoginPage = lazy(() => import('@/admin/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const AdminDashboard = lazy(() => import('@/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminBooks = lazy(() => import('@/admin/AdminBooks').then(m => ({ default: m.AdminBooks })));
const AdminAuthors = lazy(() => import('@/admin/AdminAuthors').then(m => ({ default: m.AdminAuthors })));
const AdminCategories = lazy(() => import('@/admin/AdminCategories').then(m => ({ default: m.AdminCategories })));
const AdminBlog = lazy(() => import('@/admin/AdminBlog').then(m => ({ default: m.AdminBlog })));
const AdminReviews = lazy(() => import('@/admin/AdminReviews').then(m => ({ default: m.AdminReviews })));
const AdminUsers = lazy(() => import('@/admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminAnalytics = lazy(() => import('@/admin/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const AdminNewsletter = lazy(() => import('@/admin/AdminNewsletter').then(m => ({ default: m.AdminNewsletter })));
const AdminCampaigns = lazy(() => import('@/admin/AdminCampaigns').then(m => ({ default: m.AdminCampaigns })));
const AdminAIMood = lazy(() => import('@/admin/AdminAIMood').then(m => ({ default: m.AdminAIMood })));
const AdminEmailMarketing = lazy(() => import('@/admin/AdminEmailMarketing').then(m => ({ default: m.AdminEmailMarketing })));
const AdminSettings = lazy(() => import('@/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminImport = lazy(() => import('@/admin/AdminImport').then(m => ({ default: m.AdminImport })));
const AdminContentWarnings = lazy(() => import('@/admin/AdminContentWarnings').then(m => ({ default: m.AdminContentWarnings })));
const AdminCharacters = lazy(() => import('@/admin/AdminCharacters').then(m => ({ default: m.AdminCharacters })));
const AdminSeries = lazy(() => import('@/admin/AdminSeries').then(m => ({ default: m.AdminSeries })));
const AdminEditions = lazy(() => import('@/admin/AdminEditions').then(m => ({ default: m.AdminEditions })));
const AdminAwards = lazy(() => import('@/admin/AdminAwards').then(m => ({ default: m.AdminAwards })));
const AdminBookEditor = lazy(() => import('@/admin/AdminBookEditor').then(m => ({ default: m.AdminBookEditor })));
const AdminBlogEditor = lazy(() => import('@/admin/AdminBlogEditor').then(m => ({ default: m.AdminBlogEditor })));

function AdminFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function SectionFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-pulse h-6 w-32 bg-muted rounded" />
    </div>
  );
}

// ── AppView type (backward compat) ──────────────────────────────────────────
export type AppView =
  | { type: 'home' }
  | { type: 'category'; category: Category }
  | { type: 'book'; book: Book; backTo?: 'home' | 'category' }
  | { type: 'admin'; page: AdminPage }
  | { type: 'legal'; pageKey: string }
  | { type: 'search' };

// â”€â”€ Navigation context (wraps React Router) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface AppNavContextType {
  navigate: (view: AppView) => void;
  openBook: (book: Book) => void;
  openCategory: (category: Category) => void;
  openAdmin: () => void;
  openLegal: (pageKey: string) => void;
  goHome: () => void;
  currentView: AppView;
}

const AppNavContext = createContext<AppNavContextType | undefined>(undefined);

export function useAppNav() {
  const ctx = useContext(AppNavContext);
  if (!ctx) throw new Error('useAppNav must be used within App');
  return ctx;
}

// â”€â”€ Route components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function HomePage() {
  useSEO({
    title: 'The Book Times - Book Recommendations | Discover Your Next Great Read',
    description: 'Discover your next great read with personalized book recommendations. Explore 50,000+ books across every genre with curated suggestions, ratings, and reviews.',
    ogTitle: 'The Book Times - Book Recommendations',
    ogDescription: 'Discover your next great read with personalized book recommendations. Explore 50,000+ books across every genre with curated suggestions.',
    ogImage: `${window.location.origin}/og-image.png`,
    ogType: 'website',
    ogUrl: window.location.origin,
    canonical: window.location.origin,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'The Book Times',
        url: window.location.origin,
        description: 'Book recommendations platform. Discover your next great read from 50,000+ books.',
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${window.location.origin}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'The Book Times',
        url: window.location.origin,
        description: 'Book discovery and recommendation platform',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How does The Book Times recommend books?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The Book Times analyzes your reading preferences, ratings, and browsing behavior to suggest personalized book recommendations across 50,000+ titles.',
            },
          },
          {
            '@type': 'Question',
            name: 'Is The Book Times free to use?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes! The Book Times is completely free to browse, search, and get book recommendations. You can create an account to save wishlists, write reviews, and get personalized suggestions.',
            },
          },
          {
            '@type': 'Question',
            name: 'What genres are available on The Book Times?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The Book Times covers every major genre including Fiction, Non-Fiction, Science Fiction, Fantasy, Mystery, Romance, Self-Help, Technology, Biography, History, and many more.',
            },
          },
          {
            '@type': 'Question',
            name: 'How can I write a book review?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Create a free account on The Book Times, navigate to any book page, and click the "Write a Review" button. You can rate the book from 1-5 stars and share your thoughts.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I buy books through The Book Times?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The Book Times provides convenient links to purchase books on Amazon. When you find a book you love, simply click the "Buy on Amazon" button to purchase it.',
            },
          },
        ],
      },
    ],
  });

  return (
    <main className="bg-background">
      {/* 1. Hero — focused, premium, single CTA-pair */}
      <ErrorBoundary section="Hero"><HeroV2 /></ErrorBoundary>

      {/* 2. Quick Discover — horizontal pill navigation to key surfaces */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Quick Discover"><QuickDiscoverBar /></ErrorBoundary>
      </Suspense>

      {/* 3. Personal Dashboard — auth-only consolidated block (recently viewed + shelf + challenge) */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Personal Dashboard"><PersonalDashboard /></ErrorBoundary>
      </Suspense>

      {/* 4. Trending — primary public discovery anchor */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Trending"><Trending /></ErrorBoundary>
      </Suspense>

      {/* 5. Book of the Day — premium editorial spotlight */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Book of the Day"><BookOfTheDay /></ErrorBoundary>
      </Suspense>

      {/* 6. Categories — minimal genre browsing grid */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Categories"><Categories /></ErrorBoundary>
      </Suspense>

      {/* 7. Discover Shelves — tabbed New Releases + Top Rated (replaces two duplicate-looking sections) */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Discover Shelves"><DiscoverShelves /></ErrorBoundary>
      </Suspense>

      {/* 8. Feature Hub — what The Book Times can do for you */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Feature Hub"><FeatureHub /></ErrorBoundary>
      </Suspense>

      {/* 9. Featured Authors — community / human element */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Featured Authors"><FeaturedAuthors /></ErrorBoundary>
      </Suspense>

      {/* 11. Top 20 Books — editor's choice carousel */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Top 20 Books"><Top20Carousel /></ErrorBoundary>
      </Suspense>

      {/* 12. Testimonials — social proof */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Testimonials"><Testimonials /></ErrorBoundary>
      </Suspense>

      {/* 12. Newsletter — primary conversion section */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Newsletter"><Newsletter /></ErrorBoundary>
      </Suspense>

      {/* 13. Popular Searches — SEO + internal linking */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Popular Searches"><PopularSearches /></ErrorBoundary>
      </Suspense>

      {/* 14. Latest from the Blog — compact strip at very bottom */}
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Blog Strip"><BlogStrip /></ErrorBoundary>
      </Suspense>
    </main>
  );
}

function CategoryRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { goHome, openBook } = useAppNav();
  const [category, setCategory] = useState<Category | null>(null);

  useEffect(() => {
    if (slug) {
      import('@/api/client').then(({ categoriesApi }) => {
        categoriesApi.list().then((cats: any[]) => {
          const found = cats.find((c: any) => c.slug === slug);
          if (found) {
            setCategory({
              id: String(found.id),
              name: found.name,
              slug: found.slug,
              description: found.description || '',
              imageUrl: found.imageUrl || found.image_url || '',
              metaTitle: found.metaTitle || found.meta_title || '',
              metaDescription: found.metaDescription || found.meta_description || '',
              bookCount: found.bookCount || found.book_count || 0,
            });
          }
        });
      });
    }
  }, [slug]);

  if (!category) {
    return (
      <main>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </main>
    );
  }

  return (
    <main>
      <ErrorBoundary section="Category">
        <CategoryPage category={category} onBack={goHome} onBookClick={openBook} />
      </ErrorBoundary>
    </main>
  );
}

function BookRoute() {
  const { slug } = useParams<{ slug: string }>();
  const routerNavigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setBook(null);
      setNotFound(false);
      setLoadError('Missing book slug');
      return;
    }

    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    setBook(null);
    setNotFound(false);
    setLoadError(null);

    const loadBook = async (attempt = 0): Promise<void> => {
      try {
        const response = await booksApi.getBySlug(slug);
        if (cancelled) return;
        setBook(mapBook(response));
        setNotFound(false);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 404) {
          setBook(null);
          setNotFound(true);
          return;
        }

        if (attempt < 1) {
          retryTimeout = setTimeout(() => {
            void loadBook(attempt + 1);
          }, 250);
          return;
        }

        setBook(null);
        setLoadError(err instanceof Error ? err.message : 'Failed to load book');
      }
    };

    void loadBook();

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [slug]);

  if (notFound) {
    return (
      <main className="pt-16">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <h2 className="text-2xl font-bold">Book not found</h2>
          <p className="text-muted-foreground">The book you're looking for doesn't exist.</p>
          <button onClick={() => routerNavigate('/')} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Go Home</button>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="pt-16">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <h2 className="text-2xl font-bold">We couldn&apos;t load this book</h2>
          <p className="text-muted-foreground">Please try again in a moment.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Retry</button>
        </div>
      </main>
    );
  }

  if (!book) {
    return (
      <main className="pt-16">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </main>
    );
  }

  return (
    <main className="pt-16">
      <ErrorBoundary section="Book">
        <BookPage book={book} onBack={() => routerNavigate(-1)} />
      </ErrorBoundary>
    </main>
  );
}

function SeriesRoute() {
  const { slug } = useParams<{ slug: string }>();
  const routerNavigate = useNavigate();
  const [series, setSeries] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (slug) {
      import('@/api/client').then(({ seriesApi }) => {
        seriesApi.getBySlug(slug).then((res: any) => {
          setSeries(res.series);
        }).catch(() => setError(true));
      });
    }
  }, [slug]);

  if (error) {
    return (
      <main className="pt-16">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <h2 className="text-2xl font-bold">Series not found</h2>
          <p className="text-muted-foreground">The series you're looking for doesn't exist.</p>
          <button onClick={() => routerNavigate('/')} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Go Home</button>
        </div>
      </main>
    );
  }

  if (!series) {
    return (
      <main className="pt-16">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </main>
    );
  }

  return (
    <main className="pt-16">
      <ErrorBoundary section="Series">
        <SeriesPage series={series} onBack={() => routerNavigate(-1)} />
      </ErrorBoundary>
    </main>
  );
}

function LegalRoute() {
  const { pageKey } = useParams<{ pageKey: string }>();
  const routerNavigate = useNavigate();
  if (!pageKey) return null;
  return <LegalPage pageKey={pageKey} onBack={() => routerNavigate('/')} />;
}

function MoodDiscoveryRoute() {
  const { slug } = useParams<{ slug: string }>();
  const routerNavigate = useNavigate();
  return (
    <main className="pt-16">
      <ErrorBoundary section="Mood Discovery">
        <MoodDiscoveryPage initialSlug={slug} onBack={() => routerNavigate(-1)} />
      </ErrorBoundary>
    </main>
  );
}

function AdminRoute() {
  const { page } = useParams<{ page: string }>();
  const { isAdmin } = useAuth();
  const routerNavigate = useNavigate();
  const adminPage = (page || 'dashboard') as AdminPage;

  if (!isAdmin) {
    // Show dedicated admin login page instead of generic "Access Denied"
    return (
      <Suspense fallback={<AdminFallback />}>
        <AdminLoginPage
          onSuccess={() => routerNavigate('/admin/dashboard')}
          onCancel={() => routerNavigate('/')}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminLayout activePage={adminPage} onNavigate={(p) => routerNavigate(`/admin/${p}`)} onExit={() => routerNavigate('/')}>
        {adminPage === 'dashboard' && <AdminDashboard />}
        {adminPage === 'books' && <AdminBooks />}
        {adminPage === 'authors' && <AdminAuthors />}
        {adminPage === 'categories' && <AdminCategories />}
        {adminPage === 'series' && <AdminSeries />}
        {adminPage === 'editions' && <AdminEditions />}
        {adminPage === 'blog' && <AdminBlog />}
        {adminPage === 'reviews' && <AdminReviews />}
        {adminPage === 'characters' && <AdminCharacters />}
        {adminPage === 'users' && <AdminUsers />}
        {adminPage === 'analytics' && <AdminAnalytics />}
        {adminPage === 'newsletter' && <AdminNewsletter />}
        {adminPage === 'campaigns' && <AdminCampaigns />}
        {adminPage === 'awards' && <AdminAwards />}
        {adminPage === 'ai-mood' && <AdminAIMood />}
        {adminPage === 'email-marketing' && <AdminEmailMarketing />}
        {adminPage === 'import' && <AdminImport />}
        {adminPage === 'content-warnings' && <AdminContentWarnings />}
        {adminPage === 'settings' && <AdminSettings />}
      </AdminLayout>
    </Suspense>
  );
}

function AdminBookEditorRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { isAdmin } = useAuth();
  const routerNavigate = useNavigate();

  if (!isAdmin) {
    return (
      <Suspense fallback={<AdminFallback />}>
        <AdminLoginPage
          onSuccess={() => routerNavigate(slug ? `/admin/books/edit/${slug}` : '/admin/books/new')}
          onCancel={() => routerNavigate('/')}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminLayout activePage="books" onNavigate={(p) => routerNavigate(`/admin/${p}`)} onExit={() => routerNavigate('/')}>
        <AdminBookEditor bookSlug={slug} />
      </AdminLayout>
    </Suspense>
  );
}

function AdminBlogEditorRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { isAdmin } = useAuth();
  const routerNavigate = useNavigate();

  if (!isAdmin) {
    return (
      <Suspense fallback={<AdminFallback />}>
        <AdminLoginPage
          onSuccess={() => routerNavigate(slug ? `/admin/blog/edit/${slug}` : '/admin/blog/new')}
          onCancel={() => routerNavigate('/')}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminLayout activePage="blog" onNavigate={(p) => routerNavigate(`/admin/${p}`)} onExit={() => routerNavigate('/')}>
        <AdminBlogEditor postSlug={slug} />
      </AdminLayout>
    </Suspense>
  );
}

function NotFoundPage() {
  const routerNavigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 text-center">
      <div className="relative">
        <span className="text-[10rem] leading-none font-bold text-muted-foreground/10 select-none">404</span>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-serif font-bold mb-2">This page got lost in the stacks</h1>
        <p className="text-muted-foreground max-w-md">The page you're looking for doesn't exist or may have been moved. Try searching for what you need, or head back home.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => routerNavigate('/')} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium transition-colors">
          Browse Books
        </button>
        <button onClick={() => routerNavigate('/search')} className="px-6 py-2.5 border border-border rounded-lg hover:bg-accent font-medium transition-colors">
          Search
        </button>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {['Trending', 'Categories', 'Blog'].map(label => (
          <button
            key={label}
            onClick={() => routerNavigate(`/${label.toLowerCase()}`)}
            className="px-3 py-1 text-xs rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// â”€â”€ Main App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function App() {
  const routerNavigate = useNavigate();
  const location = useLocation();
  const { isAdmin, user } = useAuth();
  const [adminSlugVerified, setAdminSlugVerified] = useState(false);
  // Onboarding modal: show for newly registered users who haven't completed it
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && (user as any).onboardingCompleted === false) {
      // Small delay so the welcome toast shows first
      const t = setTimeout(() => setShowOnboarding(true), 800);
      return () => clearTimeout(t);
    }
  }, [user]);

  // Auto-scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  // Derive current view from URL for backward compat
  const currentView: AppView = (() => {
    const p = location.pathname;
    if (p.startsWith('/admin')) return { type: 'admin', page: (p.split('/')[2] || 'dashboard') as AdminPage };
    if (p.startsWith('/category/')) return { type: 'category', category: { id: '', name: '', slug: p.split('/')[2] || '', bookCount: 0 } };
    if (p.startsWith('/book/')) return { type: 'book', book: {} as Book };
    if (p.startsWith('/legal/')) return { type: 'legal', pageKey: p.split('/')[2] || '' };
    if (p.startsWith('/search')) return { type: 'search' };
    return { type: 'home' };
  })();

  const isAdminView = currentView.type === 'admin';
  const isLegalView = currentView.type === 'legal';

  // Secret admin slug check
  useEffect(() => {
    const checkAdminPath = async () => {
      const path = location.pathname;
      if (!path || path === '/') return;
      if ([
        '/search',
        '/admin',
        '/category',
        '/categories',
        '/book',
        '/series',
        '/discover',
        '/author',
        '/author-portal',
        '/users',
        '/discussions',
        '/book-clubs',
        '/giveaways',
        '/owned-books',
        '/my-tags',
        '/journal',
        '/quizzes',
        '/awards',
        '/lists',
        '/compare',
        '/up-next',
        '/for-you',
        '/feed',
        '/reading-challenge',
        '/my-stats',
        '/year-in-books',
        '/import',
        '/pricing',
        '/settings',
        '/trending',
        '/blog',
        '/legal',
      ].some((routePrefix) => path.startsWith(routePrefix))) return;
      const slug = path.slice(1);
      if (!slug || slug.length < 6) return;
      try {
        const res = await settingsApi.verifyAdminSlug(slug);
        if (res.valid) {
          setAdminSlugVerified(true);
          routerNavigate('/', { replace: true });
        }
      } catch { /* invalid slug */ }
    };
    checkAdminPath();
  }, [location.pathname, routerNavigate]);

  useEffect(() => {
    if (!adminSlugVerified) return;
    setAdminSlugVerified(false);
    if (isAdmin) {
      routerNavigate('/admin/dashboard');
    } else {
      // Navigate to admin login page (AdminRoute will show the login form)
      routerNavigate('/admin/login');
    }
  }, [adminSlugVerified, isAdmin, routerNavigate]);

  // â”€â”€ Backward-compatible nav helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const navigate = useCallback((v: AppView) => {
    switch (v.type) {
      case 'home': routerNavigate('/'); break;
      case 'category': routerNavigate(`/category/${v.category.slug}`); break;
      case 'book': routerNavigate(`/book/${v.book.slug}`); break;
      case 'admin': routerNavigate(`/admin/${v.page}`); break;
      case 'legal': routerNavigate(`/legal/${v.pageKey}`); break;
      case 'search': routerNavigate('/search'); break;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [routerNavigate]);

  const openBook = useCallback((book: Book) => {
    routerNavigate(`/book/${book.slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [routerNavigate]);

  const openCategory = useCallback((category: Category) => {
    routerNavigate(`/category/${category.slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [routerNavigate]);

  const openAdmin = useCallback(() => routerNavigate('/admin/dashboard'), [routerNavigate]);
  const openLegal = useCallback((pageKey: string) => { routerNavigate(`/legal/${pageKey}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [routerNavigate]);
  const goHome = useCallback(() => { routerNavigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [routerNavigate]);

  const navCtx: AppNavContextType = { navigate, openBook, openCategory, openAdmin, openLegal, goHome, currentView };

  return (
    <AppNavContext.Provider value={navCtx}>
      <div className="min-h-screen bg-background">
        <Toaster position="top-center" richColors />
        <AuthModal />
        {/* Genre onboarding — shown once after registration */}
        <GenreOnboardingModal
          open={showOnboarding}
          onComplete={() => setShowOnboarding(false)}
        />
        {!isAdminView && !isLegalView && <Navigation />}

        <main className={!isAdminView && !isLegalView ? 'pt-16 sm:pt-20' : ''}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/trending" element={<TrendingPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/category/:slug" element={<CategoryRoute />} />
          <Route path="/book/:slug" element={<BookRoute />} />
          <Route path="/series/:slug" element={<SeriesRoute />} />
          <Route path="/discover/mood" element={<MoodDiscoveryRoute />} />
          <Route path="/discover/mood/:slug" element={<MoodDiscoveryRoute />} />
          <Route path="/author/:slug" element={<AuthorPage />} />
          <Route path="/author-portal" element={<AuthorPortal />} />
          <Route path="/users/:id" element={<PublicUserProfilePage />} />
          <Route path="/discussions/:id" element={<DiscussionThread />} />
          <Route path="/book-clubs" element={<BookClubsPage />} />
          <Route path="/book-clubs/:id" element={<BookClubDetail />} />
          <Route path="/giveaways" element={<GiveawaysPage />} />
          <Route path="/giveaways/my-entries" element={<MyGiveawayEntriesPage />} />
          <Route path="/giveaways/:id" element={<GiveawayDetailPage />} />
          <Route path="/owned-books" element={<OwnedBooksPage />} />
          <Route path="/my-tags" element={<TagsPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/quizzes" element={<QuizzesDiscoverPage />} />
          <Route path="/quizzes/create" element={<QuizCreatePage />} />
          <Route path="/quizzes/:id" element={<QuizPage />} />
          <Route path="/awards/:year" element={<ChoiceAwardsPage />} />
          <Route path="/lists" element={<ReadingListsPage />} />
          <Route path="/lists/discover" element={<ListDiscoveryPage />} />
          <Route path="/lists/mine/:id" element={<ReadingListDetailPage />} />
          <Route path="/lists/public/:userId/:slug" element={<PublicReadingListPage />} />
          <Route path="/lists/:id" element={<CommunityListPage />} />
          <Route path="/compare" element={<BookComparePage />} />
          <Route path="/up-next" element={<TBRQueuePage />} />
          <Route path="/for-you" element={<ForYouPage />} />
          <Route path="/feed" element={<ActivityFeed />} />
          <Route path="/reading-challenge" element={<ReadingChallengePage />} />
          <Route path="/my-stats" element={<ReadingStatsPage />} />
          <Route path="/year-in-books/:year" element={<YearInBooks />} />
          <Route path="/import/goodreads" element={<ImportGoodreadsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/settings/digest" element={<DigestSettingsPage />} />
          <Route path="/settings/webhooks" element={<WebhooksPage />} />
          <Route path="/legal/:pageKey" element={<LegalRoute />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/admin/books/new" element={<AdminBookEditorRoute />} />
          <Route path="/admin/books/edit/:slug" element={<AdminBookEditorRoute />} />
          <Route path="/admin/blog/new" element={<AdminBlogEditorRoute />} />
          <Route path="/admin/blog/edit/:slug" element={<AdminBlogEditorRoute />} />
          <Route path="/admin/:page" element={<AdminRoute />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </main>

        {!isAdminView && !isLegalView && <Footer />}
        <WishlistDrawer />
        <AdminBar />
        <ScrollToTop />
        <BackToTop />
      </div>
    </AppNavContext.Provider>
  );
}

export default App;
