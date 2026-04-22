import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ListChecks, GitCompare, BookOpen, MessageSquare, Gift, Users,
  Sparkles, Trophy, Heart, Compass, PenLine, Target,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

interface FeatureCard {
  icon: typeof ListChecks;
  title: string;
  description: string;
  href: string;
  gradient: string;
  iconColor: string;
  auth?: boolean;
}

const FEATURES: FeatureCard[] = [
  { icon: Sparkles, title: 'AI Mood Match', description: "Tell us how you feel and we'll find the perfect book", href: '/discover/mood', gradient: 'from-violet-500/15 to-purple-500/10', iconColor: 'text-violet-500' },
  { icon: ListChecks, title: 'Reading Lists', description: 'Create, discover, and share curated book collections', href: '/lists/discover', gradient: 'from-emerald-500/15 to-green-500/10', iconColor: 'text-emerald-500' },
  { icon: GitCompare, title: 'Compare Books', description: 'Put two books side-by-side and pick your next read', href: '/compare', gradient: 'from-blue-500/15 to-cyan-500/10', iconColor: 'text-blue-500' },
  { icon: PenLine, title: 'Reading Journal', description: 'Track your thoughts, quotes, and reading progress', href: '/journal', gradient: 'from-amber-500/15 to-yellow-500/10', iconColor: 'text-amber-500', auth: true },
  { icon: Users, title: 'Book Clubs', description: 'Join a community of readers and discuss books together', href: '/book-clubs', gradient: 'from-pink-500/15 to-rose-500/10', iconColor: 'text-pink-500' },
  { icon: Gift, title: 'Giveaways', description: 'Enter to win free books from publishers and authors', href: '/giveaways', gradient: 'from-orange-500/15 to-red-500/10', iconColor: 'text-orange-500' },
  { icon: Trophy, title: 'Choice Awards', description: 'Vote for the best books of the year across genres', href: `/awards/${new Date().getFullYear()}`, gradient: 'from-yellow-500/15 to-amber-500/10', iconColor: 'text-yellow-600' },
  { icon: BookOpen, title: 'Quizzes', description: 'Test your literary knowledge and discover new reads', href: '/quizzes', gradient: 'from-teal-500/15 to-emerald-500/10', iconColor: 'text-teal-500' },
  { icon: Target, title: 'Reading Challenge', description: 'Set a yearly goal and track your reading progress', href: '/reading-challenge', gradient: 'from-indigo-500/15 to-blue-500/10', iconColor: 'text-indigo-500', auth: true },
  { icon: Heart, title: 'For You', description: 'Personalized book picks based on your taste', href: '/for-you', gradient: 'from-rose-500/15 to-pink-500/10', iconColor: 'text-rose-500', auth: true },
  { icon: Compass, title: 'TBR Queue', description: 'Organize your "to be read" pile and decide what\'s next', href: '/up-next', gradient: 'from-slate-500/15 to-zinc-500/10', iconColor: 'text-slate-500', auth: true },
  { icon: MessageSquare, title: 'Activity Feed', description: 'See what your friends are reading and reviewing', href: '/feed', gradient: 'from-cyan-500/15 to-sky-500/10', iconColor: 'text-cyan-500', auth: true },
];

export function FeatureHub() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const visibleFeatures = FEATURES.filter(f => !f.auth || isAuthenticated);

  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">Everything You Need</h2>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm md:text-base">
            Your complete reading companion â€” discover, track, share, and connect.
          </p>
        </motion.div>

        {/* Responsive grid: 2 cols mobile, 3 cols tablet, 4 cols desktop. No horizontal scroll on mobile. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {visibleFeatures.map((feature, idx) => (
            <motion.button
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Math.min(idx * 0.04, 0.4), duration: 0.3 }}
              onClick={() => navigate(feature.href)}
              className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${feature.gradient} text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30 p-4 sm:p-5 min-h-[140px] sm:min-h-[170px] flex flex-col`}
            >
              <div className={`inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-background/70 backdrop-blur-sm shadow-sm mb-3 ${feature.iconColor}`}>
                <feature.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <h3 className="font-semibold text-sm sm:text-base leading-tight mb-1 line-clamp-1">{feature.title}</h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-3 mt-auto">
                {feature.description}
              </p>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
