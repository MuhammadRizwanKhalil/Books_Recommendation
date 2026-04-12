import { BookOpen, BookMarked, CheckCircle2, Target, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useReadingShelf } from '@/components/ReadingStatus';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'framer-motion';

export function ReadingStats() {
  const { wantToRead, reading, finished, total } = useReadingShelf();
  const { readingHistory } = useAuth();

  // Only show if user has some activity
  if (total === 0 && readingHistory.length < 3) return null;

  const yearGoal = 24; // Books per year goal
  const progress = Math.min(100, Math.round((finished.length / yearGoal) * 100));

  const stats = [
    {
      label: 'Want to Read',
      value: wantToRead.length,
      icon: BookMarked,
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-950',
      gradient: 'from-blue-500/10 to-blue-500/5',
    },
    {
      label: 'Reading',
      value: reading.length,
      icon: BookOpen,
      color: 'text-amber-500 bg-amber-50 dark:bg-amber-950',
      gradient: 'from-amber-500/10 to-amber-500/5',
    },
    {
      label: 'Finished',
      value: finished.length,
      icon: CheckCircle2,
      color: 'text-green-500 bg-green-50 dark:bg-green-950',
      gradient: 'from-green-500/10 to-green-500/5',
    },
    {
      label: 'Books Viewed',
      value: readingHistory.length,
      icon: Target,
      color: 'text-purple-500 bg-purple-50 dark:bg-purple-950',
      gradient: 'from-purple-500/10 to-purple-500/5',
    },
  ];

  return (
    <section className="py-6 sm:py-8">
      <div className="container mx-auto px-4">
        <motion.div
          className="space-y-2 mb-6"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <Badge variant="default" className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0 text-xs px-3 py-1">
            <Target className="w-3 h-3 mr-1" />
            Personal Tracker
          </Badge>
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold font-serif">Your Reading Journey</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">Track your progress and build your personal shelf</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="text-center border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                <CardContent className={`pt-4 pb-3 bg-gradient-to-b ${stat.gradient} rounded-lg`}>
                  <div className={`inline-flex p-2 rounded-full mb-2 ${stat.color}`}>
                    <stat.icon className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Annual reading goal */}
        {finished.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-0 shadow-sm">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    <span className="text-sm font-semibold">Annual Reading Goal</span>
                  </div>
                  <span className="text-sm font-medium text-primary">{finished.length} / {yearGoal} books</span>
                </div>
                <Progress value={progress} className="h-2.5" />
                <p className="text-xs text-muted-foreground mt-2">
                  {finished.length >= yearGoal
                    ? '🎉 Congratulations! You\'ve reached your reading goal!'
                    : `${yearGoal - finished.length} more books to reach your goal`}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </section>
  );
}
