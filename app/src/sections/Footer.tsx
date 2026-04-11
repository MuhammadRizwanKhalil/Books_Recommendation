import { Mail, ExternalLink } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { useSettings } from '@/components/SettingsProvider';
import { useAppNav } from '@/App';
import { useTranslation } from '@/lib/i18n';
import { LogoMark } from '@/components/ui/Logo';
import { sanitizeHtml } from '@/lib/utils';

// SVG icons for social platforms
const SocialIcons: Record<string, (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  social_facebook: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  social_twitter: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  social_instagram: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
  social_linkedin: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  social_youtube: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="#fff" d="M9.545 15.568V8.432L15.818 12z"/></svg>,
  social_tiktok: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>,
  social_pinterest: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.688 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>,
  social_goodreads: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M11.43 23.995c-3.608-.208-6.274-2.077-6.448-5.078.695.007 1.375-.013 2.07-.006.224 1.342 1.065 2.43 2.683 3.026 1.583.496 3.737.46 5.082-.174 1.351-.636 2.145-1.822 2.503-3.577.212-1.042.236-1.734.236-2.669-.013-.37.008-.74-.002-1.107-.38.706-.984 1.375-1.681 1.845-1.02.639-2.111.95-3.305.955-2.76-.028-4.834-1.468-5.968-3.94-.552-1.187-.812-2.471-.803-3.8-.012-1.396.268-2.735.887-3.97 1.087-2.327 3.058-3.755 5.71-3.895 1.39-.063 2.56.283 3.547.946.629.422 1.137.98 1.613 1.606V.79h2.06v15.271c-.009 2.16-.139 3.641-.702 5.157-.776 2.063-2.622 3.323-5.135 3.636-.58.052-1.337.064-1.929.046zm.624-7.12c1.894.004 3.468-.89 4.258-2.643.467-1.06.617-2.133.582-3.3.043-1.282-.182-2.414-.72-3.457-.817-1.554-2.259-2.41-4.078-2.44a4.766 4.766 0 00-4.119 2.163c-.602 1.01-.88 2.145-.862 3.38-.032 1.268.192 2.431.772 3.478.858 1.634 2.337 2.593 4.167 2.82z"/></svg>,
};

const SOCIAL_KEYS = [
  'social_facebook', 'social_twitter', 'social_instagram', 'social_linkedin',
  'social_youtube', 'social_tiktok', 'social_pinterest', 'social_goodreads',
];

export function Footer() {
  const { getSetting, settings } = useSettings();
  const { openLegal } = useAppNav();
  const { t } = useTranslation();
  const routerNavigate = useNavigate();
  const location = useLocation();
  const currentYear = new Date().getFullYear();

  const siteName = getSetting('site_name', 'The Book Times');
  const siteDescription = getSetting('site_description', 'AI-powered book discovery platform. Find your next great read with personalized recommendations.');
  const contactEmail = getSetting('contact_email', 'hello@thebooktimes.com');
  const affiliateDisclosure = getSetting('affiliate_disclosure', '');

  // Build active social links from settings
  const activeSocials = SOCIAL_KEYS
    .filter(key => settings[key])
    .map(key => ({
      key,
      url: settings[key],
      label: key.replace('social_', '').replace(/^\w/, c => c.toUpperCase()),
      Icon: SocialIcons[key],
    }));

  const footerLinks = {
    discover: [
      { label: t('footer.trendingBooks'), href: '/#trending', isRoute: false },
      { label: t('sections.newReleases'), href: '/#new-releases', isRoute: false },
      { label: t('sections.topRated'), href: '/#top-rated', isRoute: false },
      { label: t('nav.categories'), href: '/#categories', isRoute: false },
    ],
    company: [
      { label: t('nav.blog'), href: '/blog', isRoute: true },
      { label: t('sections.newsletter'), href: '/#newsletter', isRoute: false },
    ],
  };

  const scrollToSection = (href: string) => {
    const hash = href.replace('/', '');
    if (location.pathname !== '/') {
      routerNavigate('/' + hash);
      return;
    }
    const el = document.querySelector(hash);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const legalLinks = [
    { label: t('footer.privacy'), key: 'privacy_policy' },
    { label: t('footer.terms'), key: 'terms_conditions' },
    { label: t('footer.cookiePolicy'), key: 'cookie_policy' },
    { label: t('footer.refundPolicy'), key: 'refund_policy' },
  ];

  return (
    <footer className="bg-muted/50 border-t" role="contentinfo">
      <div className="container mx-auto px-4 py-10 sm:py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-primary shadow-sm">
                <LogoMark size={24} className="text-primary-foreground" />
              </div>
              <span className="text-xl font-bold font-serif">{siteName}</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6 max-w-none sm:max-w-xs">
              {siteDescription}
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <a href={`mailto:${contactEmail}`} className="hover:text-primary transition-colors">
                  {contactEmail}
                </a>
              </div>
            </div>

            {activeSocials.length > 0 && (
              <div className="flex items-center gap-2 mt-6">
                {activeSocials.map((social) => (
                  <a
                    key={social.key}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
                    aria-label={social.label}
                  >
                    {social.Icon ? (
                      <social.Icon className="h-5 w-5" />
                    ) : (
                      <ExternalLink className="h-5 w-5" />
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Discover */}
          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider">{t('footer.discover')}</h4>
            <ul className="space-y-3">
              {footerLinks.discover.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources (was Company) */}
          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider">{t('footer.resources')}</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  {link.isRoute ? (
                    <Link to={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider">{t('footer.legal')}</h4>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.key}>
                  <a
                    href={`/legal/${link.key}`}
                    onClick={(e) => { e.preventDefault(); openLegal(link.key); }}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-10" />

        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4 text-sm text-muted-foreground">
            <span>&copy; {currentYear} {siteName}. {t('footer.allRightsReserved')}</span>
            <span className="hidden md:inline">&bull;</span>
            <span>{getSetting('footer_tagline', 'Made with \u2665 for book lovers')}</span>
          </div>
        </div>

        {/* Affiliate Disclosure from settings */}
        {affiliateDisclosure && (
          <div className="mt-8 p-4 bg-muted/50 rounded-lg text-center">
            <div
              className="text-xs text-muted-foreground [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(affiliateDisclosure) }}
            />
          </div>
        )}
      </div>
    </footer>
  );
}
