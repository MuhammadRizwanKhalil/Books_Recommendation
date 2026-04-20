import { useState } from 'react';
import { Mail, Send, CheckCircle, BookOpen, Bell, PartyPopper, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { newsletterApi } from '@/api/client';
import { useAppNav } from '@/App';
import { usePublicStats } from '@/hooks/useBooks';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { openLegal } = useAppNav();
  const { stats } = usePublicStats();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      await newsletterApi.subscribe(email);
      setIsSubscribed(true);
      toast.success('Welcome aboard! Check your inbox for a confirmation email.', { duration: 5000 });
    } catch (err: any) {
      toast.error(err?.body?.error || 'Subscription failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="newsletter" className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="overflow-hidden rounded-2xl border shadow-lg">
            <div className="grid lg:grid-cols-2">
              {/* Content Side */}
              <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
                  Get Your Weekly Reading Digest
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Curated book picks delivered every Sunday morning. Join our growing community.
                </p>

                <div className="space-y-2.5 mb-6">
                  {[
                    { icon: BookOpen, text: 'Curated weekly reading lists' },
                    { icon: Mail, text: 'AI-powered recommendations' },
                    { icon: Bell, text: 'New release alerts' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="p-1.5 rounded-full bg-primary/10">
                        <item.icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      {item.text}
                    </div>
                  ))}
                </div>

                {stats && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                    <div className="flex -space-x-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 border-2 border-background flex items-center justify-center text-[10px] text-white font-medium">
                          {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs"><strong>{stats.totalSubscribers.toLocaleString()}+</strong> readers and counting</span>
                  </div>
                )}
              </div>

              {/* Form Side */}
              <div className="relative bg-primary p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80" />
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />

                <div className="relative z-10">
                  {!isSubscribed ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <label className="text-white font-medium text-sm">Your email address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                        <Input
                          type="email"
                          placeholder="reader@example.com"
                          className="pl-11 py-5 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full py-5 bg-white text-primary hover:bg-white/90 font-semibold" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Subscribing...</>
                        ) : (
                          <>Subscribe Now <Send className="ml-2 h-4 w-4" /></>
                        )}
                      </Button>
                      <p className="text-white/60 text-xs text-center">
                        No spam ever.{' '}
                        <button onClick={() => openLegal('privacy_policy')} className="underline hover:text-white">Privacy Policy</button>.
                      </p>
                      <div className="flex items-center justify-center gap-4 text-white/60 text-[10px]">
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> No spam</span>
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Unsubscribe anytime</span>
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Free forever</span>
                      </div>
                    </form>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center text-white space-y-4"
                    >
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="relative mx-auto w-16 h-16">
                        <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="relative w-16 h-16 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center">
                          <CheckCircle className="h-8 w-8 text-white" />
                        </div>
                      </motion.div>
                      <h3 className="text-xl font-bold flex items-center justify-center gap-2"><PartyPopper className="h-5 w-5" /> You&apos;re In!</h3>
                      <p className="text-white/80 text-sm">Check your inbox for a welcome email.</p>
                      <div className="space-y-1.5 text-left bg-white/10 rounded-xl p-3 text-sm text-white/75">
                        <div className="flex items-center gap-2"><Mail className="h-3 w-3 shrink-0" /> Welcome email on its way</div>
                        <div className="flex items-center gap-2"><BookOpen className="h-3 w-3 shrink-0" /> Curated picks every week</div>
                        <div className="flex items-center gap-2"><Heart className="h-3 w-3 shrink-0" /> Unsubscribe anytime</div>
                      </div>
                      <Button variant="outline" className="border-white/40 text-white hover:bg-white/20" onClick={() => { setIsSubscribed(false); setEmail(''); }}>
                        Subscribe another
                      </Button>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
