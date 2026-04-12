import { useState } from 'react';
import { BookCard } from './BookCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Book } from '@/types';

interface BookGridProps {
  books: Book[];
  loading?: boolean;
  variant?: 'compact' | 'standard' | 'featured';
  columns?: 2 | 3 | 4 | 6;
  pageSize?: number;
  showPagination?: boolean;
}

export function BookGrid({ 
  books, 
  loading = false, 
  variant = 'standard',
  columns = 4,
  pageSize = 0,
  showPagination = false,
}: BookGridProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const usePagination = showPagination && pageSize > 0 && books.length > pageSize;
  const totalPages = usePagination ? Math.ceil(books.length / pageSize) : 1;
  const displayedBooks = usePagination
    ? books.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : books;

  const columnClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
  };

  if (loading) {
    return (
      <div className={`grid ${columnClasses[columns]} gap-3 sm:gap-4 md:gap-6`}>
        {Array.from({ length: pageSize || 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[2/3]" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No books found.</p>
      </div>
    );
  }

  return (
    <div>
      <div className={`grid ${columnClasses[columns]} gap-3 sm:gap-4 md:gap-6`}>
        {displayedBooks.map((book) => (
          <div key={book.id} className="min-w-0">
            <BookCard book={book} variant={variant} />
          </div>
        ))}
      </div>

      {/* Pagination */}
      {usePagination && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="icon"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const page = i + 1;
            // Show first, last, current, and adjacent pages
            if (
              page === 1 ||
              page === totalPages ||
              Math.abs(page - currentPage) <= 1
            ) {
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              );
            }
            // Show ellipsis
            if (Math.abs(page - currentPage) === 2) {
              return (
                <span key={page} className="px-1 text-muted-foreground">
                  ...
                </span>
              );
            }
            return null;
          })}

          <Button
            variant="outline"
            size="icon"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <span className="text-sm text-muted-foreground ml-2">
            {books.length} book{books.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
