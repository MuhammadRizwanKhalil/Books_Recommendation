import { useEffect, useState } from 'react';
import { Clock3, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { ApiError, tbrQueueApi } from '@/api/client';
import { cn } from '@/lib/utils';

interface TBRQueueButtonProps {
  bookId: string;
  className?: string;
}

export function TBRQueueButton({ bookId, className }: TBRQueueButtonProps) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [inQueue, setInQueue] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setInQueue(false);
      return;
    }

    tbrQueueApi.list()
      .then((response) => setInQueue(response.items.some((item) => item.bookId === bookId)))
      .catch(() => setInQueue(false));
  }, [bookId, isAuthenticated]);

  async function handleClick() {
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }

    setLoading(true);
    try {
      if (inQueue) {
        await tbrQueueApi.remove(bookId);
        setInQueue(false);
        toast.success('Removed from your Up Next queue');
      } else {
        await tbrQueueApi.add(bookId);
        setInQueue(true);
        toast.success('Added to your Up Next queue');
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update your queue';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={inQueue ? 'default' : 'outline'}
      className={cn('gap-2', className)}
      onClick={() => void handleClick()}
      disabled={loading}
      data-testid="tbr-queue-button"
    >
      {inQueue ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
      {inQueue ? 'In Up Next' : 'Add to Up Next'}
    </Button>
  );
}
