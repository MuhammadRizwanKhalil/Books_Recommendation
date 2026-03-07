import { Heart, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useWishlist } from '@/components/WishlistProvider';
import { useAppNav } from '@/App';
import type { Book } from '@/types';

export function WishlistDrawer() {
  const { wishlist, removeFromWishlist, clearWishlist, isWishlistOpen, closeWishlistDrawer, wishlistCount } = useWishlist();
  const { openBook } = useAppNav();

  return (
    <Sheet open={isWishlistOpen} onOpenChange={(open) => { if (!open) closeWishlistDrawer(); }}>
      <SheetContent side="right" className="w-96 p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500 fill-red-500" />
            My Wishlist ({wishlistCount})
          </SheetTitle>
        </SheetHeader>

        {wishlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
            <Heart className="h-12 w-12" />
            <p className="text-lg font-medium">Your wishlist is empty</p>
            <p className="text-sm text-center px-8">
              Click the heart icon on any book to add it to your wishlist.
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 h-[calc(100vh-10rem)]">
              <div className="p-4 space-y-3">
                {wishlist.map((book: Book) => (
                  <div
                    key={book.id}
                    className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => { closeWishlistDrawer(); openBook(book); }}
                  >
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      className="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-1">{book.title}</h4>
                      <p className="text-xs text-muted-foreground">{book.author}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {book.googleRating && (
                          <span className="text-xs text-yellow-600 font-medium">★ {book.googleRating}</span>
                        )}
                        {book.price && (
                          <span className="text-xs font-semibold">${book.price}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); removeFromWishlist(book.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Separator />
            <div className="p-4 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={clearWishlist}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
