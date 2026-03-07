import { Heart, BookOpen, Clock, LogOut, Star } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/AuthProvider';
import { useWishlist } from '@/components/WishlistProvider';
import { formatDate } from '@/lib/utils';

export function UserProfile() {
  const { user, signOut, readingHistory } = useAuth();
  const { wishlist, removeFromWishlist } = useWishlist();

  if (!user) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="text-xs">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </AvatarFallback>
          </Avatar>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-96 p-0">
        <SheetHeader className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>
                {user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left truncate">{user.name}</SheetTitle>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Member since {formatDate(user.joinedAt)}
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 px-6 pb-4">
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-bold">{wishlist.length}</p>
            <p className="text-xs text-muted-foreground">Wishlist</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-bold">{readingHistory.length}</p>
            <p className="text-xs text-muted-foreground">Viewed</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-bold">{user.reviewCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">Reviews</p>
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="wishlist" className="flex-1">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 h-auto py-0">
            <TabsTrigger
              value="wishlist"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-3"
            >
              <Heart className="h-4 w-4 mr-1.5" />
              Wishlist
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-3"
            >
              <Clock className="h-4 w-4 mr-1.5" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wishlist" className="mt-0">
            <ScrollArea className="h-[calc(100vh-380px)]">
              {wishlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6">
                  <Heart className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground text-center">
                    Your wishlist is empty. Click the heart icon on any book to save it.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {wishlist.map((book) => (
                    <div key={book.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        className="w-12 h-16 object-cover rounded shadow-sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{book.title}</p>
                        <p className="text-xs text-muted-foreground">{book.author}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs">{book.googleRating?.toFixed(1) || 'N/A'}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive shrink-0"
                        onClick={() => removeFromWishlist(book.id)}
                      >
                        <Heart className="h-4 w-4 fill-current" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <ScrollArea className="h-[calc(100vh-380px)]">
              {readingHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6">
                  <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground text-center">
                    No reading history yet. Start exploring books!
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {readingHistory.map((entry, idx) => (
                    <div key={`${entry.bookId}-${idx}`} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                      <img
                        src={entry.bookCover}
                        alt={entry.bookTitle}
                        className="w-12 h-16 object-cover rounded shadow-sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{entry.bookTitle}</p>
                        <p className="text-xs text-muted-foreground">{entry.bookAuthor}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(entry.viewedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator />
        <div className="p-4 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            size="sm"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
