/**
 * i18n — Internationalization System
 * ────────────────────────────────────
 * Lightweight context-based i18n with:
 * - Static string translations via JSON locale files
 * - React context + hook for components
 * - Language detection from browser / stored preference
 * - Dynamic import of locale bundles (code-splitting)
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ar' | 'zh';

export type TranslationKey = string;
export type TranslationValues = Record<string, string | number>;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
  dir: 'ltr' | 'rtl';
  availableLocales: { code: Locale; name: string; nativeName: string }[];
}

// ── Available Locales ───────────────────────────────────────────────────────

export const AVAILABLE_LOCALES: { code: Locale; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];

const RTL_LOCALES: Locale[] = ['ar'];

// ── English (default) translations ──────────────────────────────────────────

const en: Record<string, string> = {
  // Navigation
  'nav.home': 'Home',
  'nav.books': 'Books',
  'nav.categories': 'Categories',
  'nav.authors': 'Authors',
  'nav.blog': 'Blog',
  'nav.lists': 'My Lists',
  'nav.compare': 'Compare',
  'nav.search': 'Search',
  'nav.signIn': 'Sign In',
  'nav.signOut': 'Sign Out',
  'nav.admin': 'Admin',
  'nav.profile': 'Profile',
  'nav.language': 'Language',
  'nav.wishlist': 'Wishlist',
  'nav.createAccount': 'Create Account',

  // Hero
  'hero.title': 'Discover Your Next Great Read',
  'hero.subtitle': 'Explore thousands of books, get personalized recommendations, and track your reading journey.',
  'hero.searchPlaceholder': 'Search books, authors, genres...',
  'hero.browseBooks': 'Browse Books',

  // Sections
  'sections.trending': 'Trending Now',
  'sections.topRated': 'Top Rated',
  'sections.newReleases': 'New Releases',
  'sections.categories': 'Browse Categories',
  'sections.featuredAuthors': 'Featured Authors',
  'sections.blog': 'From Our Blog',
  'sections.newsletter': 'Stay Updated',
  'sections.forYou': 'Recommended For You',
  'sections.bookOfTheDay': 'Book of the Day',
  'sections.recentlyViewed': 'Recently Viewed',
  'sections.readingStats': 'Your Reading Stats',

  // Book
  'book.by': 'by',
  'book.pages': 'pages',
  'book.rating': 'Rating',
  'book.reviews': 'Reviews',
  'book.addToWishlist': 'Add to Wishlist',
  'book.removeFromWishlist': 'Remove from Wishlist',
  'book.addToList': 'Add to List',
  'book.readMore': 'Read More',
  'book.showLess': 'Show Less',
  'book.published': 'Published',
  'book.publisher': 'Publisher',
  'book.language': 'Language',
  'book.isbn': 'ISBN',
  'book.description': 'Description',
  'book.recommendations': 'You Might Also Like',
  'book.writeReview': 'Write a Review',
  'book.noReviews': 'No reviews yet. Be the first to share your thoughts!',
  'book.share': 'Share',
  'book.compare': 'Compare',
  'book.buyNow': 'Buy Now',

  // Reading Progress
  'progress.wantToRead': 'Want to Read',
  'progress.reading': 'Reading',
  'progress.finished': 'Finished',
  'progress.currentPage': 'Current Page',
  'progress.startedAt': 'Started',
  'progress.finishedAt': 'Finished on',

  // Lists
  'lists.title': 'My Reading Lists',
  'lists.createNew': 'Create New List',
  'lists.empty': 'No reading lists yet. Create one to get started!',
  'lists.books': 'books',
  'lists.share': 'Share List',
  'lists.delete': 'Delete List',

  // Auth
  'auth.signIn': 'Sign In',
  'auth.signUp': 'Sign Up',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.name': 'Name',
  'auth.forgotPassword': 'Forgot Password?',
  'auth.noAccount': 'Don\'t have an account?',
  'auth.hasAccount': 'Already have an account?',

  // Common
  'common.loading': 'Loading...',
  'common.error': 'Something went wrong',
  'common.retry': 'Try Again',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.create': 'Create',
  'common.search': 'Search',
  'common.filter': 'Filter',
  'common.sort': 'Sort',
  'common.viewAll': 'View All',
  'common.showMore': 'Show More',
  'common.showLess': 'Show Less',
  'common.noResults': 'No results found',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.previous': 'Previous',

  // Footer
  'footer.about': 'About',
  'footer.privacy': 'Privacy Policy',
  'footer.terms': 'Terms of Service',
  'footer.contact': 'Contact',
  'footer.copyright': '© {year} The Book Times. All rights reserved.',

  // Newsletter
  'newsletter.title': 'Stay Updated',
  'newsletter.subtitle': 'Get the latest book recommendations and updates delivered to your inbox.',
  'newsletter.placeholder': 'Enter your email',
  'newsletter.subscribe': 'Subscribe',
  'newsletter.success': 'Successfully subscribed!',

  // Compare
  'compare.title': 'Compare Books',
  'compare.addBook': 'Add a Book',
  'compare.searchBooks': 'Search books to compare...',
  'compare.rating': 'Rating',
  'compare.pages': 'Pages',
  'compare.price': 'Price',
  'compare.published': 'Published',

  // Subscription
  'subscription.upgrade': 'Upgrade',
  'subscription.currentPlan': 'Current Plan',
  'subscription.free': 'Free',
  'subscription.plus': 'Plus',
  'subscription.premium': 'Premium',
  'subscription.perMonth': '/month',
  'subscription.perYear': '/year',

  // Hero extras
  'hero.booksIndexed': 'Books Indexed',
  'hero.totalReviews': 'Total Reviews',
  'hero.avgRating': 'Avg Rating',
  'hero.popular': 'Popular:',
  'hero.exploreTrending': 'Explore Trending',

  // Trending extras
  'trending.title': 'Trending Books',
  'trending.viewAll': 'View All Trending',
  'trending.numberOne': '#1 Trending',
  'trending.ratings': 'ratings',
  'trending.buyOnAmazon': 'Buy on Amazon',
  'trending.viewDetails': 'View Details',
  'trending.moreTrending': 'More Trending Books',

  // Categories extras
  'categories.title': 'Browse by Category',
  'categories.subtitle': 'Explore our curated collection of books across every genre.',

  // NewReleases extras
  'newReleases.thisWeek': 'This Week',
  'newReleases.lastWeek': 'Last Week',
  'newReleases.thisMonth': 'This Month',
  'newReleases.lastMonth': 'Last Month',
  'newReleases.viewAll': 'View All New Releases',
  'newReleases.autoImport': 'Automated Book Import',
  'newReleases.autoImportDesc': 'New books are automatically imported daily from Google Books API.',
  'newReleases.liveUpdates': 'Live Updates',

  // TopRated extras
  'topRated.title': 'Top Rated Books',
  'topRated.badge': 'Highest Rated',
  'topRated.subtitle': 'Books that have earned the highest praise from our community of readers.',
  'topRated.viewAll': 'View All Top Rated',
  'topRated.ratings': 'ratings',
  'topRated.moreTopRated': 'More Highly Rated Books',

  // Blog extras
  'blog.aiGenerated': 'AI Generated',
  'blog.autoGenerated': 'Auto-Generated',
  'blog.editorial': 'Editorial',
  'blog.aiPowered': 'AI-Powered Content',
  'blog.subtitle': 'Weekly curated reading lists and literary insights, powered by AI.',
  'blog.viewAllPosts': 'View All Posts',
  'blog.booksFeatured': 'books featured',
  'blog.aiWeekly': 'AI-Generated Weekly Content',
  'blog.aiWeeklyDesc': 'Our system automatically generates fresh reading lists and literary insights every week.',
  'blog.articles': 'Articles',
  'blog.weekly': 'Weekly',
  'blog.newContent': 'New Content',

  // Newsletter extras
  'newsletter.weeklyLists': 'Weekly curated reading lists',
  'newsletter.aiRecommendations': 'AI-powered personalized recommendations',
  'newsletter.newAlerts': 'New release alerts',
  'newsletter.joinBookLovers': 'Join {count}+ book lovers who get weekly recommendations',
  'newsletter.emailLabel': 'Enter your email address',
  'newsletter.emailPlaceholder': 'you@example.com',
  'newsletter.subscribing': 'Subscribing...',
  'newsletter.subscribeNow': 'Subscribe Now',
  'newsletter.noSpam': 'No spam, unsubscribe anytime. Read our',
  'newsletter.subscribed': 'You\'re Subscribed!',
  'newsletter.checkInbox': 'Check your inbox for a confirmation email and your first curated reading list.',
  'newsletter.subscribeAnother': 'Subscribe Another Email',

  // Footer extras
  'footer.discover': 'Discover',
  'footer.resources': 'Resources',
  'footer.legal': 'Legal',
  'footer.trendingBooks': 'Trending Books',
  'footer.cookiePolicy': 'Cookie Policy',
  'footer.refundPolicy': 'Refund Policy',
  'footer.allRightsReserved': 'All rights reserved.',
};

// ── Locale Bundles (lazy-loaded) ────────────────────────────────────────────

const localeLoaders: Record<Locale, () => Record<string, string>> = {
  en: () => en,
  es: () => ({
    ...en,
    'nav.home': 'Inicio',
    'nav.books': 'Libros',
    'nav.categories': 'Categorías',
    'nav.authors': 'Autores',
    'nav.blog': 'Blog',
    'nav.lists': 'Mis Listas',
    'nav.compare': 'Comparar',
    'nav.search': 'Buscar',
    'nav.signIn': 'Iniciar Sesión',
    'nav.signOut': 'Cerrar Sesión',
    'nav.language': 'Idioma',
    'nav.wishlist': 'Lista de deseos',
    'nav.createAccount': 'Crear Cuenta',
    'hero.title': 'Descubre tu Próxima Gran Lectura',
    'hero.subtitle': 'Explora miles de libros, obtén recomendaciones personalizadas y sigue tu viaje de lectura.',
    'hero.searchPlaceholder': 'Buscar libros, autores, géneros...',
    'hero.browseBooks': 'Explorar Libros',
    'sections.trending': 'Tendencias',
    'sections.topRated': 'Mejor Valorados',
    'sections.newReleases': 'Novedades',
    'sections.categories': 'Explorar Categorías',
    'sections.forYou': 'Recomendados Para Ti',
    'book.by': 'por',
    'book.pages': 'páginas',
    'book.rating': 'Valoración',
    'book.reviews': 'Reseñas',
    'book.addToWishlist': 'Añadir a Favoritos',
    'book.recommendations': 'También Te Puede Gustar',
    'book.writeReview': 'Escribir Reseña',
    'common.loading': 'Cargando...',
    'common.error': 'Algo salió mal',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.search': 'Buscar',
    'common.noResults': 'Sin resultados',
    'newsletter.title': 'Mantente Actualizado',
    'newsletter.subscribe': 'Suscribirse',
    'newsletter.subscribeNow': 'Suscríbete Ahora',
    'newsletter.subscribing': 'Suscribiendo...',
    'newsletter.subscribed': '¡Estás Suscrito!',
    'trending.title': 'Libros en Tendencia',
    'trending.viewAll': 'Ver Todas las Tendencias',
    'trending.viewDetails': 'Ver Detalles',
    'trending.ratings': 'valoraciones',
    'categories.title': 'Explorar por Categoría',
    'categories.subtitle': 'Explora nuestra colección curada de libros en todos los géneros.',
    'topRated.title': 'Libros Mejor Valorados',
    'topRated.badge': 'Mejor Valorado',
    'topRated.ratings': 'valoraciones',
    'blog.viewAllPosts': 'Ver Todas las Publicaciones',
    'footer.discover': 'Descubrir',
    'footer.resources': 'Recursos',
    'footer.legal': 'Legal',
    'footer.copyright': '© {year} The Book Times. Todos los derechos reservados.',
  }),
  fr: () => ({
    ...en,
    'nav.home': 'Accueil',
    'nav.books': 'Livres',
    'nav.categories': 'Catégories',
    'nav.authors': 'Auteurs',
    'nav.blog': 'Blog',
    'nav.lists': 'Mes Listes',
    'nav.compare': 'Comparer',
    'nav.search': 'Rechercher',
    'nav.signIn': 'Se Connecter',
    'nav.signOut': 'Se Déconnecter',
    'nav.language': 'Langue',
    'nav.wishlist': 'Liste de souhaits',
    'nav.createAccount': 'Créer un Compte',
    'hero.title': 'Découvrez Votre Prochaine Grande Lecture',
    'hero.subtitle': 'Explorez des milliers de livres, obtenez des recommandations personnalisées et suivez votre parcours de lecture.',
    'hero.searchPlaceholder': 'Rechercher livres, auteurs, genres...',
    'hero.browseBooks': 'Parcourir les Livres',
    'sections.trending': 'Tendances',
    'sections.topRated': 'Les Mieux Notés',
    'sections.newReleases': 'Nouveautés',
    'sections.forYou': 'Recommandé Pour Vous',
    'book.by': 'par',
    'book.pages': 'pages',
    'book.rating': 'Note',
    'book.reviews': 'Avis',
    'common.loading': 'Chargement...',
    'common.error': 'Une erreur est survenue',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.search': 'Rechercher',
    'newsletter.title': 'Restez Informé',
    'newsletter.subscribe': 'S\'abonner',
    'newsletter.subscribeNow': 'S\'abonner Maintenant',
    'newsletter.subscribing': 'Abonnement en cours...',
    'newsletter.subscribed': 'Vous êtes Abonné!',
    'trending.title': 'Livres Tendance',
    'trending.viewAll': 'Voir Toutes les Tendances',
    'trending.viewDetails': 'Voir les Détails',
    'trending.ratings': 'notes',
    'categories.title': 'Parcourir par Catégorie',
    'categories.subtitle': 'Explorez notre collection de livres dans tous les genres.',
    'topRated.title': 'Livres les Mieux Notés',
    'topRated.badge': 'Mieux Noté',
    'topRated.ratings': 'notes',
    'blog.viewAllPosts': 'Voir Tous les Articles',
    'footer.discover': 'Découvrir',
    'footer.resources': 'Ressources',
    'footer.legal': 'Mentions Légales',
    'footer.copyright': '© {year} The Book Times. Tous droits réservés.',
  }),
  de: () => ({
    ...en,
    'nav.home': 'Startseite',
    'nav.books': 'Bücher',
    'nav.categories': 'Kategorien',
    'nav.authors': 'Autoren',
    'nav.search': 'Suche',
    'nav.signIn': 'Anmelden',
    'nav.signOut': 'Abmelden',
    'nav.language': 'Sprache',
    'nav.wishlist': 'Wunschliste',
    'nav.createAccount': 'Konto erstellen',
    'hero.title': 'Entdecke Dein Nächstes Großartiges Buch',
    'hero.subtitle': 'Erkunde tausende Bücher, erhalte personalisierte Empfehlungen und verfolge deine Lesereise.',
    'hero.searchPlaceholder': 'Bücher, Autoren, Genres suchen...',
    'hero.browseBooks': 'Bücher Durchsuchen',
    'sections.trending': 'Im Trend',
    'sections.topRated': 'Bestbewertet',
    'sections.newReleases': 'Neuerscheinungen',
    'sections.forYou': 'Für Dich Empfohlen',
    'book.by': 'von',
    'book.pages': 'Seiten',
    'book.rating': 'Bewertung',
    'book.reviews': 'Rezensionen',
    'common.loading': 'Wird geladen...',
    'common.error': 'Etwas ist schiefgelaufen',
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'common.search': 'Suche',
    'newsletter.title': 'Bleib auf dem Laufenden',
    'newsletter.subscribe': 'Abonnieren',
    'newsletter.subscribeNow': 'Jetzt Abonnieren',
    'newsletter.subscribing': 'Wird abonniert...',
    'newsletter.subscribed': 'Du bist Abonniert!',
    'trending.title': 'Trendige Bücher',
    'trending.viewAll': 'Alle Trends Anzeigen',
    'trending.viewDetails': 'Details Anzeigen',
    'trending.ratings': 'Bewertungen',
    'categories.title': 'Nach Kategorie Durchsuchen',
    'categories.subtitle': 'Entdecke unsere kuratierte Sammlung von Büchern in jedem Genre.',
    'topRated.title': 'Bestbewertete Bücher',
    'topRated.badge': 'Bestbewertet',
    'topRated.ratings': 'Bewertungen',
    'blog.viewAllPosts': 'Alle Beiträge Anzeigen',
    'footer.discover': 'Entdecken',
    'footer.resources': 'Ressourcen',
    'footer.legal': 'Rechtliches',
    'footer.copyright': '© {year} The Book Times. Alle Rechte vorbehalten.',
  }),
  ar: () => ({
    ...en,
    'nav.home': 'الرئيسية',
    'nav.books': 'الكتب',
    'nav.categories': 'الفئات',
    'nav.authors': 'المؤلفون',
    'nav.search': 'بحث',
    'nav.signIn': 'تسجيل الدخول',
    'nav.signOut': 'تسجيل الخروج',
    'nav.language': 'اللغة',
    'nav.wishlist': 'قائمة الرغبات',
    'nav.createAccount': 'إنشاء حساب',
    'hero.title': 'اكتشف قراءتك العظيمة التالية',
    'hero.subtitle': 'استكشف آلاف الكتب واحصل على توصيات مخصصة وتابع رحلة القراءة الخاصة بك.',
    'hero.searchPlaceholder': 'البحث عن كتب، مؤلفين، أنواع...',
    'hero.browseBooks': 'تصفح الكتب',
    'sections.trending': 'الرائج الآن',
    'sections.topRated': 'الأعلى تقييماً',
    'sections.newReleases': 'إصدارات جديدة',
    'sections.forYou': 'مُوصى لك',
    'book.by': 'بقلم',
    'book.pages': 'صفحات',
    'book.rating': 'التقييم',
    'book.reviews': 'المراجعات',
    'common.loading': 'جارِ التحميل...',
    'common.error': 'حدث خطأ ما',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.search': 'بحث',
    'newsletter.title': 'ابقَ محدثاً',
    'newsletter.subscribe': 'اشترك',
    'newsletter.subscribeNow': 'اشترك الآن',
    'newsletter.subscribing': 'جارِ الاشتراك...',
    'newsletter.subscribed': 'أنت مشترك!',
    'trending.title': 'الكتب الرائجة',
    'trending.viewAll': 'عرض جميع الرائج',
    'trending.viewDetails': 'عرض التفاصيل',
    'trending.ratings': 'تقييمات',
    'categories.title': 'تصفح حسب الفئة',
    'categories.subtitle': 'استكشف مجموعتنا المنسقة من الكتب عبر كل نوع.',
    'topRated.title': 'الكتب الأعلى تقييماً',
    'topRated.badge': 'الأعلى تقييماً',
    'topRated.ratings': 'تقييمات',
    'blog.viewAllPosts': 'عرض جميع المقالات',
    'footer.discover': 'اكتشف',
    'footer.resources': 'الموارد',
    'footer.legal': 'قانوني',
    'footer.copyright': '© {year} The Book Times. جميع الحقوق محفوظة.',
  }),
  zh: () => ({
    ...en,
    'nav.home': '首页',
    'nav.books': '书籍',
    'nav.categories': '分类',
    'nav.authors': '作者',
    'nav.search': '搜索',
    'nav.signIn': '登录',
    'nav.signOut': '退出',
    'nav.language': '语言',
    'nav.wishlist': '愿望清单',
    'nav.createAccount': '创建账户',
    'hero.title': '发现你的下一本好书',
    'hero.subtitle': '探索数千本书籍，获取个性化推荐，追踪你的阅读之旅。',
    'hero.searchPlaceholder': '搜索书籍、作者、类型...',
    'hero.browseBooks': '浏览书籍',
    'sections.trending': '热门趋势',
    'sections.topRated': '评分最高',
    'sections.newReleases': '新书上架',
    'sections.forYou': '为你推荐',
    'book.by': '作者：',
    'book.pages': '页',
    'book.rating': '评分',
    'book.reviews': '评论',
    'common.loading': '加载中...',
    'common.error': '出了点问题',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.search': '搜索',
    'newsletter.title': '保持更新',
    'newsletter.subscribe': '订阅',
    'newsletter.subscribeNow': '立即订阅',
    'newsletter.subscribing': '正在订阅...',
    'newsletter.subscribed': '您已订阅!',
    'trending.title': '热门书籍',
    'trending.viewAll': '查看所有热门',
    'trending.viewDetails': '查看详情',
    'trending.ratings': '评分',
    'categories.title': '按类别浏览',
    'categories.subtitle': '探索我们精心策划的各类书籍。',
    'topRated.title': '评分最高的书籍',
    'topRated.badge': '评分最高',
    'topRated.ratings': '评分',
    'blog.viewAllPosts': '查看所有文章',
    'footer.discover': '发现',
    'footer.resources': '资源',
    'footer.legal': '法律信息',
    'footer.copyright': '© {year} The Book Times. 版权所有。',
  }),
};

// ── Translation function ────────────────────────────────────────────────────

function translate(
  messages: Record<string, string>,
  key: string,
  values?: TranslationValues,
): string {
  let text = messages[key] || key;
  if (values) {
    for (const [k, v] of Object.entries(values)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

// ── Context ─────────────────────────────────────────────────────────────────

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Shorthand hook — just the `t` function */
export function useTranslation() {
  const { t, locale, dir } = useI18n();
  return { t, locale, dir };
}

// ── Detect browser locale ───────────────────────────────────────────────────

function detectLocale(): Locale {
  const stored = localStorage.getItem('thebooktimes-locale') as Locale | null;
  if (stored && AVAILABLE_LOCALES.some(l => l.code === stored)) return stored;

  const browserLang = navigator.language.split('-')[0] as Locale;
  if (AVAILABLE_LOCALES.some(l => l.code === browserLang)) return browserLang;

  return 'en';
}

// ── Provider Component ──────────────────────────────────────────────────────

interface I18nProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

export function I18nProvider({ children, defaultLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale || detectLocale());
  const [messages, setMessages] = useState<Record<string, string>>(localeLoaders[locale]());

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('thebooktimes-locale', newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = RTL_LOCALES.includes(newLocale) ? 'rtl' : 'ltr';
  }, []);

  useEffect(() => {
    setMessages(localeLoaders[locale]());
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey, values?: TranslationValues) => translate(messages, key, values),
    [messages],
  );

  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir, availableLocales: AVAILABLE_LOCALES }}>
      {children}
    </I18nContext.Provider>
  );
}

export { I18nContext };
