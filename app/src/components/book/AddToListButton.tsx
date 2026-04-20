import { useState } from 'react';
import { ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AddToListModal } from './AddToListModal';

interface AddToListButtonProps {
  bookId: string;
  bookTitle: string;
  compact?: boolean;
  className?: string;
}

export function AddToListButton({ bookId, bookTitle, compact = false, className }: AddToListButtonProps) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [open, setOpen] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!isAuthenticated) {
      openAuthModal('signin');
      toast.info('Sign in to add books to your lists');
      return;
    }

    setOpen(true);
  };

  const button = compact ? (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={handleClick}
      className={cn('rounded-full bg-white/80 shadow-sm backdrop-blur-sm', className)}
      aria-label={`Add ${bookTitle} to a reading list`}
      data-testid="add-to-list-button"
    >
      <ListPlus className="h-4 w-4" />
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      className={cn('gap-2', className)}
      data-testid="add-to-list-button"
    >
      <ListPlus className="h-4 w-4" />
      Add to List
    </Button>
  );

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>Add to List</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AddToListModal
        open={open}
        onOpenChange={setOpen}
        bookId={bookId}
        bookTitle={bookTitle}
      />
    </>
  );
}
