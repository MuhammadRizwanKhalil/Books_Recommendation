import { useState, useEffect, useCallback, lazy, Suspense, createContext, useContext } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ScrollToTop } from '@/components/ScrollToTop';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthModal } from '@/components/AuthModal';
import { CategoryPage } from '@/components/CategoryPage';
import { BookPage } from '@/components/book/BookPage';
import { AuthorPage } from '@/components/AuthorPage';
import { ReadingListsPage, ReadingListDetailPage, PublicReadingListPage } from '@/components/ReadingListsPage';
import { BookComparePage } from '@/components/BookComparePage';
import { ForYouPage } from '@/components/ForYouPage';
import { PricingPage } from '@/components/PricingPage';
import { DigestSettingsPage } from '@/components/DigestSettingsPage';
import { WebhooksPage } from '@/components/WebhooksPage';
import { SearchPage } from '@/components/SearchPage';
import { BlogPage } from '@/components/BlogPage';
import { BlogPostPage } from '@/components/BlogPostPage';
import { TrendingPage } from '@/components/TrendingPage';
import { CategoriesPage } from '@/components/CategoriesPage';
import { Navigation } from '@/sections/Navigation';
import { Hero } from '@/sections/Hero';
import { Footer } from '@/sections/Footer';

// â”€â”€ Lazy-loaded below-fold sections (reduces initial bundle) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Trending = lazy(() => import('@/sections/Trending').then(m => ({ default: m.Trending })));
const Categories = lazy(() => import('@/sections/Categories').then(m => ({ default: m.Categories })));
const NewReleases = lazy(() => import('@/sections/NewReleases').then(m => ({ default: m.NewReleases })));
const TopRated = lazy(() => import('@/sections/TopRated').then(m => ({ default: m.TopRated })));
const Testimonials = lazy(() => import('@/sections/Testimonials').then(m => ({ default: m.Testimonials })));
const FeaturedAuthors = lazy(() => import('@/sections/FeaturedAuthors').then(m => ({ default: m.FeaturedAuthors })));
const Blog = lazy(() => import('@/sections/Blog').then(m => ({ default: m.Blog })));
const Newsletter = lazy(() => import('@/sections/Newsletter').then(m => ({ default: m.Newsletter })));
const BookOfTheDay = lazy(() => import('@/sections/BookOfTheDay').then(m => ({ default: m.BookOfTheDay })));
const RecentlyViewed = lazy(() => import('@/sections/RecentlyViewed').then(m => ({ default: m.RecentlyViewed })));
const PopularSearches = lazy(() => import('@/sections/PopularSearches').then(m => ({ default: m.PopularSearches })));
const ReadingStats = lazy(() => import('@/sections/ReadingStats').then(m => ({ default: m.ReadingStats })));
import type { AdminPage } from '@/admin/AdminLayout';
import { LegalPage } from '@/components/LegalPage';
import { AdminBar } from '@/components/AdminBar';
import { WishlistDrawer } from '@/components/WishlistDrawer';
import { useAuth } from '@/components/AuthProvider';
import { settingsApi } from '@/api/client';
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
const AdminEmailMarketing = lazy(() => import('@/admin/AdminEmailMarketing').then(m => ({ default: m.AdminEmailMarketing })));
const AdminSettings = lazy(() => import('@/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminImport = lazy(() => import('@/admin/AdminImport').then(m => ({ default: m.AdminImport })));
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

function SectionDivider() {
  return (
    <div className="container mx-auto px-4" aria-hidden="true">
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
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
    <main>
      <ErrorBoundary section="Hero"><Hero /></ErrorBoundary>
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Recently Viewed"><RecentlyViewed /></ErrorBoundary>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Trending"><Trending /></ErrorBoundary>
      </Suspense>
      <SectionDivider />
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Book of the Day"><BookOfTheDay /></ErrorBoundary>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Categories"><Categories /></ErrorBoundary>
      </Suspense>
      <SectionDivider />
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="New Releases"><NewReleases /></ErrorBoundary>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Top Rated"><TopRated /></ErrorBoundary>
      </Suspense>
      <SectionDivider />
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Featured Authors"><FeaturedAuthors /></ErrorBoundary>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Testimonials"><Testimonials /></ErrorBoundary>
      </Suspense>
      <SectionDivider />
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Reading Stats"><ReadingStats /></ErrorBoundary>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Blog"><Blog /></ErrorBoundary>
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Popular Searches"><PopularSearches /></ErrorBoundary>
      </Suspense>
      <SectionDivider />
      <Suspense fallback={<SectionFallback />}>
        <ErrorBoundary section="Newsletter"><Newsletter /></ErrorBoundary>
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
      <main className="pt-16">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </main>
    );
  }

  return (
    <main className="pt-16">
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
  const [error, setError] = useState(false);

  useEffect(() => {
    if (slug) {
      import('@/api/client').then(({ booksApi }) => {
        booksApi.getBySlug(slug).then((b: any) => {
          setBook({
            id: String(b.id), googleBooksId: b.googleBooksId || '', title: b.title,
            subtitle: b.subtitle || '', author: b.author, description: b.description || '',
            coverImage: b.coverImage || '', publisher: b.publisher || '',
            publishedDate: b.publishedDate || '', pageCount: b.pageCount || 0,
            language: b.language || 'en', categories: b.categories || [],
            googleRating: b.googleRating ?? 0, ratingsCount: b.ratingsCount ?? 0,
            computedScore: b.computedScore ?? 0, price: b.price ?? 0,
            currency: b.currency || 'USD', amazonUrl: b.amazonUrl || '',
            isbn10: b.isbn10 || '', isbn13: b.isbn13 || '', slug: b.slug || '',
            metaTitle: b.metaTitle || '', metaDescription: b.metaDescription || '',
            status: b.status || 'PUBLISHED', isActive: b.isActive ?? true,
            authorId: b.authorId || undefined,
            authorData: b.authorData || null,
            indexedAt: b.indexedAt || '', createdAt: b.createdAt || '', updatedAt: b.updatedAt || '',
          });
        }).catch(() => setError(true));
      });
    }
  }, [slug]);

  if (error) {
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

function LegalRoute() {
  const { pageKey } = useParams<{ pageKey: string }>();
  const routerNavigate = useNavigate();
  if (!pageKey) return null;
  return <LegalPage pageKey={pageKey} onBack={() => routerNavigate('/')} />;
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
        {adminPage === 'blog' && <AdminBlog />}
        {adminPage === 'reviews' && <AdminReviews />}
        {adminPage === 'users' && <AdminUsers />}
        {adminPage === 'analytics' && <AdminAnalytics />}
        {adminPage === 'newsletter' && <AdminNewsletter />}
        {adminPage === 'campaigns' && <AdminCampaigns />}
        {adminPage === 'email-marketing' && <AdminEmailMarketing />}
        {adminPage === 'import' && <AdminImport />}
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
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-xl text-muted-foreground">Page not found</p>
      <button onClick={() => routerNavigate('/')} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Go Home</button>
    </div>
  );
}

// â”€â”€ Main App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function App() {
  const routerNavigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [adminSlugVerified, setAdminSlugVerified] = useState(false);

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
      if (['/search', '/admin', '/category', '/book', '/blog', '/legal'].some(r => path.startsWith(r))) return;
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
        {!isAdminView && !isLegalView && <Navigation />}

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/trending" element={<TrendingPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/category/:slug" element={<CategoryRoute />} />
          <Route path="/book/:slug" element={<BookRoute />} />
          <Route path="/author/:slug" element={<AuthorPage />} />
          <Route path="/lists" element={<ReadingListsPage />} />
          <Route path="/lists/:id" element={<ReadingListDetailPage />} />
          <Route path="/lists/public/:userId/:slug" element={<PublicReadingListPage />} />
          <Route path="/compare" element={<BookComparePage />} />
          <Route path="/for-you" element={<ForYouPage />} />
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

        {!isAdminView && !isLegalView && <Footer />}
        <WishlistDrawer />
        <AdminBar />
        <ScrollToTop />
      </div>
    </AppNavContext.Provider>
  );
}

export default App;
