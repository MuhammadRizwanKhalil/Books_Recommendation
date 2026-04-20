import { useNavigate } from 'react-router-dom';
import { TrendingUp, Sparkles, BookOpen, Users, Gift, Award, ListChecks, Brain, Compass, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/components/AuthProvider';

const DISCOVER_ITEMS = [
  { icon: TrendingUp, label: 'Trending', href: '/trending', color: 'from-orange-500 to-red-500', desc: 'Hot right now' },
  { icon: Sparkles, label: 'For You', href: '/for-you', color: 'from-violet-500 to-purple-500', desc: 'Personalized', auth: true },
  { icon: Brain, label: 'AI Mood Match', href: '/discover/mood', color: 'from-cyan-500 to-blue-500', desc: 'How do you feel?' },
  { icon: Flame, label: 'New Releases', href: '/search?sort=newest', color: 'from-amber-500 to-orange-500', desc: 'Fresh titles' },
  { icon: ListChecks, label: 'Reading Lists', href: '/lists/discover', color: 'from-emerald-500 to-green-500', desc: 'Curated collections' },
  { icon: Users, label: 'Book Clubs', href: '/book-clubs', color: 'from-pink-500 to-rose-500', desc: 'Join readers' },
  { icon: Gift, label: 'Giveaways', href: '/giveaways', color: 'from-yellow-500 to-amber-500', desc: 'Win free books' },
  { icon: Award, label: 'Awards', href: `/awards/${new Date().getFullYear()}`, color: 'from-indigo-500 to-violet-500', desc: 'Best of the year' },
  { icon: BookOpen, label: 'Quizzes', href: '/quizzes', color: 'from-teal-500 to-emerald-500', desc: 'Test your knowledge' },
  { icon: Compass, label: 'Compare', href: '/compare', color: 'from-slate-500 to-zinc-500', desc: 'Side by side' },
];

export function QuickDiscoverBar() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const items = DISCOVER_ITEMS.filter(item => !item.auth || isAuthenticated);

  return (
    <section className="py-6 border-b bg-muted/30" aria-label="Quick discover">
      <div className="container mx-auto px-4">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 snap-x">
          {items.map((item, idx) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
              onClick={() => navigate(item.href)}
              className="flex-shrink-0 snap-start group relative flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-background border hover:border-primary/30 hover:shadow-md transition-all duration-200 min-w-[90px]"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:shadow-lg transition-all duration-200`}>
                <item.icon className="h-5 w-5 text-white" />
              </div>
              <span className="text-xs font-medium text-foreground whitespace-nowrap">{item.label}</span>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.desc}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
