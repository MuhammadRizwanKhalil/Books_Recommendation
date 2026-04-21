import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ListChecks, GitCompare, BookOpen, MessageSquare, Gift, Users,
  Sparkles, Trophy, Heart, Compass, PenLine, Target
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

interface FeatureCard {
  icon: typeof ListChecks;
  title: string;
  description: string;
  href: string;
  gradient: string;
  auth?: boolean;
}

const FEATURES: FeatureCard[] = [
  {
    icon: Sparkles,
    title: 'AI Mood Match',
    description: 'Tell us how you feel and we\'ll find the perfect book',
    href: '/discover/mood',
    gradient: 'from-violet-500/10 to-purple-500/10 hover:from-violet-500/15 hover:to-purple-500/15',
  },
  {
    icon: ListChecks,
    title: 'Reading Lists',
    description: 'Create, discover, and share curated book collections',
    href: '/lists/discover',
    gradient: 'from-emerald-500/10 to-green-500/10 hover:from-emerald-500/15 hover:to-green-500/15',
  },
  {
    icon: GitCompare,
    title: 'Compare Books',
    description: 'Put two books side-by-side and pick your next read',
    href: '/compare',
    gradient: 'from-blue-500/10 to-cyan-500/10 hover:from-blue-500/15 hover:to-cyan-500/15',
  },
  {
    icon: PenLine,
    title: 'Reading Journal',
    description: 'Track your thoughts, quotes, and reading progress',
    href: '/journal',
    gradient: 'from-amber-500/10 to-yellow-500/10 hover:from-amber-500/15 hover:to-yellow-500/15',
    auth: true,
  },
  {
    icon: Users,
    title: 'Book Clubs',
    description: 'Join a community of readers and discuss books together',
    href: '/book-clubs',
    gradient: 'from-pink-500/10 to-rose-500/10 hover:from-pink-500/15 hover:to-rose-500/15',
  },
  {
    icon: Gift,
    title: 'Giveaways',
    description: 'Enter to win free books from publishers and authors',
    href: '/giveaways',
    gradient: 'from-orange-500/10 to-red-500/10 hover:from-orange-500/15 hover:to-red-500/15',
  },
  {
    icon: Trophy,
    title: 'Choice Awards',
    description: 'Vote for the best books of the year across genres',
    href: `/awards/${new Date().getFullYear()}`,
    gradient: 'from-yellow-500/10 to-amber-500/10 hover:from-yellow-500/15 hover:to-amber-500/15',
  },
  {
    icon: BookOpen,
    title: 'Quizzes',
    description: 'Test your literary knowledge and discover new reads',
    href: '/quizzes',
    gradient: 'from-teal-500/10 to-emerald-500/10 hover:from-teal-500/15 hover:to-emerald-500/15',
  },
  {
    icon: Target,
    title: 'Reading Challenge',
    description: 'Set a yearly goal and track your reading progress',
    href: '/reading-challenge',
    gradient: 'from-indigo-500/10 to-blue-500/10 hover:from-indigo-500/15 hover:to-blue-500/15',
    auth: true,
  },
  {
    icon: Heart,
    title: 'For You',
    description: 'Personalized book picks based on your taste',
    href: '/for-you',
    gradient: 'from-rose-500/10 to-pink-500/10 hover:from-rose-500/15 hover:to-pink-500/15',
    auth: true,
  },
  {
    icon: Compass,
    title: 'TBR Queue',
    description: 'Organize your "to be read" pile and decide what\'s next',
    href: '/up-next',
    gradient: 'from-slate-500/10 to-zinc-500/10 hover:from-slate-500/15 hover:to-zinc-500/15',
    auth: true,
  },
  {
    icon: MessageSquare,
    title: 'Activity Feed',
    description: 'See what your friends are reading and reviewing',
    href: '/feed',
    gradient: 'from-cyan-500/10 to-sky-500/10 hover:from-cyan-500/15 hover:to-sky-500/15',
    auth: true,
  },
];

export function FeatureHub() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Show all public features + auth features only if authenticated
  const visibleFeatures = FEATURES.filter(f => !f.auth || isAuthenticated);

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Everything You Need</h2>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            Your complete reading companion — discover, track, share, and connect.
          </p>
        </motion.div>

        <div className="overflow-x-auto scrollbar-hide pb-3 -mx-4 px-4 scroll-fade">
          <div className="flex w-max min-w-full justify-center gap-4 snap-x">
            {visibleFeatures.map((feature, idx) => (
              <motion.button
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.04, duration: 0.3 }}
                onClick={() => navigate(feature.href)}
                className={`group flex-shrink-0 snap-start w-[220px] sm:w-[240px] h-[190px] p-5 rounded-2xl border bg-gradient-to-br ${feature.gradient} text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/20 flex flex-col`}
              >
                <feature.icon className="h-6 w-6 text-primary mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold text-sm mb-1 line-clamp-1">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mt-auto">{feature.description}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
