import { useState } from 'react';
import { Mail, Send, CheckCircle, Sparkles, BookOpen, Bell, PartyPopper, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { newsletterApi } from '@/api/client';
import { useAppNav } from '@/App';
import { useSettings } from '@/components/SettingsProvider';
import { usePublicStats } from '@/hooks/useBooks';
import { useTranslation } from '@/lib/i18n';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { openLegal } = useAppNav();
  const { getSetting } = useSettings();
  const { stats } = usePublicStats();
  const { t } = useTranslation();
  const newsletterHeading = getSetting('newsletter_heading', 'Get Your Weekly Reading Digest');
  const newsletterDescription = getSetting('newsletter_description', 'Curated book picks delivered every Sunday morning. Join our growing community of passionate readers.');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    
    try {
      await newsletterApi.subscribe(email);
      setIsSubscribed(true);
      toast.success('Welcome aboard! Check your inbox for a confirmation email.', {
        duration: 5000,
      });
    } catch (err: any) {
      toast.error(err?.body?.error || 'Subscription failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const benefits = [
    { icon: BookOpen, text: t('newsletter.weeklyLists') },
    { icon: Sparkles, text: t('newsletter.aiRecommendations') },
    { icon: Bell, text: t('newsletter.newAlerts') },
  ];

  return (
    <section id="newsletter" className="py-10 sm:py-14 md:py-16 bg-gradient-to-b from-muted/50 via-muted/30 to-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="overflow-hidden shadow-xl border-0">
            <div className="grid lg:grid-cols-2">
              {/* Content Side */}
              <CardContent className="p-6 sm:p-8 lg:p-12 flex flex-col justify-center">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="default" className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 px-3 py-1">
                        <Mail className="w-3 h-3 mr-1" />
                        {t('sections.newsletter')}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-500/30 bg-blue-500/5">
                        Free Forever
                      </Badge>
                    </div>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif mb-3 leading-tight">
                      {newsletterHeading}
                    </h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {newsletterDescription}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {benefits.map((benefit, index) => (
                      <motion.div
                        key={index}
                        className="flex items-center gap-3"
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <div className="p-2 rounded-full bg-primary/10">
                          <benefit.icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-muted-foreground">{benefit.text}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Subscriber Count */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground bg-primary/5 rounded-lg p-3">
                    <div className="flex -space-x-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 border-2 border-background flex items-center justify-center text-xs text-white font-medium"
                        >
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{stats ? `${stats.totalSubscribers.toLocaleString()}+ readers` : 'Growing community'}</span>
                      <span className="text-xs">and counting — join them every Sunday</span>
                    </div>
                  </div>
                </div>
              </CardContent>

              {/* Form Side */}
              <div className="relative bg-primary p-5 sm:p-8 lg:p-12 flex flex-col justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
                
                <div className="relative z-10">
                  {!isSubscribed ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-white font-medium">
                          {t('newsletter.emailLabel')}
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
                          <Input
                            type="email"
                            placeholder={t('newsletter.emailPlaceholder')}
                            className="pl-12 py-6 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full py-6 bg-white text-primary hover:bg-white/90 font-semibold"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            {t('newsletter.subscribing')}
                          </>
                        ) : (
                          <>
                            {t('newsletter.subscribeNow')}
                            <Send className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                      <p className="text-white/60 text-sm text-center">
                        {t('newsletter.noSpam')}{' '}
                        <button onClick={() => openLegal('privacy_policy')} className="underline hover:text-white">{t('footer.privacy')}</button>.
                      </p>
                      <div className="flex items-center justify-center gap-4 text-white/70 text-xs pt-1">
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> No spam</span>
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Unsubscribe anytime</span>
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Free forever</span>
                      </div>
                    </form>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', duration: 0.6 }}
                      className="text-center text-white space-y-5"
                    >
                      {/* Animated success icon */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                        className="relative mx-auto w-20 h-20"
                      >
                        <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="relative w-20 h-20 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center">
                          <CheckCircle className="h-10 w-10 text-white" />
                        </div>
                      </motion.div>

                      {/* Title with confetti icon */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <h3 className="text-2xl font-bold flex items-center justify-center gap-2">
                          <PartyPopper className="h-6 w-6" />
                          {t('newsletter.subscribed')}
                        </h3>
                      </motion.div>

                      {/* Description */}
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-white/85 text-base leading-relaxed"
                      >
                        {t('newsletter.checkInbox')}
                      </motion.p>

                      {/* What's next hints */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="space-y-2 text-left bg-white/10 rounded-xl p-4"
                      >
                        <p className="text-sm font-semibold text-white/90">What happens next:</p>
                        <div className="flex items-center gap-2 text-sm text-white/75">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span>Welcome email on its way</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/75">
                          <BookOpen className="h-3.5 w-3.5 shrink-0" />
                          <span>Curated picks every week</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/75">
                          <Heart className="h-3.5 w-3.5 shrink-0" />
                          <span>No spam, unsubscribe anytime</span>
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        <Button
                          variant="outline"
                          className="border-white/40 text-white hover:bg-white/20"
                          onClick={() => {
                            setIsSubscribed(false);
                            setEmail('');
                          }}
                        >
                          {t('newsletter.subscribeAnother')}
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
