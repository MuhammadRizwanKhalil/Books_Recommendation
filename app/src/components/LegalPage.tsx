import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSettings } from '@/components/SettingsProvider';
import { sanitizeHtml } from '@/lib/utils';
import { useSEO } from '@/hooks/useSEO';

interface LegalPageProps {
  pageKey: string;
  onBack: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  privacy_policy: 'Privacy Policy',
  terms_conditions: 'Terms & Conditions',
  cookie_policy: 'Cookie Policy',
  refund_policy: 'Refund Policy',
  affiliate_disclosure: 'Affiliate Disclosure',
};

export function LegalPage({ pageKey, onBack }: LegalPageProps) {
  const { getSetting } = useSettings();
  const content = getSetting(pageKey, '<p>This page is not yet configured. Please check back later.</p>');
  const title = PAGE_TITLES[pageKey] || 'Legal';
  const siteName = getSetting('site_name', 'The Book Times');

  useSEO({
    title: `${title} | ${siteName}`,
    description: `${title} for ${siteName}. Read our ${title.toLowerCase()} to understand how we handle your data and service terms.`,
    canonical: `${window.location.origin}/legal/${pageKey}`,
  });

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to {siteName}
        </Button>

        <Card>
          <CardContent className="p-8 md:p-12">
            <h1 className="text-3xl font-bold mb-6">{title}</h1>
            <div
              className="prose prose-sm dark:prose-invert max-w-none [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-medium [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
            <p className="text-xs text-muted-foreground mt-8 pt-4 border-t">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
