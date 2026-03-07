import { BookOpen, BookMarked, CheckCircle2, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
    },
    {
      label: 'Reading',
      value: reading.length,
      icon: BookOpen,
      color: 'text-amber-500 bg-amber-50 dark:bg-amber-950',
    },
    {
      label: 'Finished',
      value: finished.length,
      icon: CheckCircle2,
      color: 'text-green-500 bg-green-50 dark:bg-green-950',
    },
    {
      label: 'Books Viewed',
      value: readingHistory.length,
      icon: Target,
      color: 'text-purple-500 bg-purple-50 dark:bg-purple-950',
    },
  ];

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold">Your Reading Journey</h2>
            <p className="text-sm text-muted-foreground">Track your progress and build your shelf</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="text-center">
                <CardContent className="pt-6 pb-4">
                  <div className={`inline-flex p-3 rounded-full mb-3 ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Annual reading goal */}
        {finished.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Annual Reading Goal</span>
                <span className="text-sm text-muted-foreground">{finished.length} / {yearGoal} books</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {finished.length >= yearGoal
                  ? '🎉 Congratulations! You\'ve reached your reading goal!'
                  : `${yearGoal - finished.length} more books to reach your goal`}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
