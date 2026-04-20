import { useEffect, useState } from 'react';
import { Heart, BookOpen, Clock, LogOut, Star, Users } from 'lucide-react';
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
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { useWishlist } from '@/components/WishlistProvider';
import { LinkedAccounts } from '@/components/LinkedAccounts';
import { socialUsersApi, type SocialUserSummaryResponse } from '@/api/client';
import { formatDate } from '@/lib/utils';

export function UserProfile() {
  const { user, signOut, readingHistory } = useAuth();
  const { wishlist, removeFromWishlist } = useWishlist();
  const [followers, setFollowers] = useState<SocialUserSummaryResponse[]>([]);
  const [following, setFollowing] = useState<SocialUserSummaryResponse[]>([]);

  useEffect(() => {
    if (!user) return;
    socialUsersApi.getFollowers(user.id).then((res) => setFollowers(res.users || [])).catch(() => setFollowers([]));
    socialUsersApi.getFollowing(user.id).then((res) => setFollowing(res.users || [])).catch(() => setFollowing([]));
  }, [user]);

  if (!user) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Open account menu" data-testid="account-menu-button">
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
      <SheetContent side="right" className="w-[min(90vw,24rem)] p-0">
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
        <div className="grid grid-cols-5 gap-2 px-6 pb-4">
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
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-bold">{user.followerCount ?? followers.length}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-bold">{user.followingCount ?? following.length}</p>
            <p className="text-xs text-muted-foreground">Following</p>
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
            <TabsTrigger
              value="social"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none py-3"
            >
              <Users className="h-4 w-4 mr-1.5" />
              Social
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

          <TabsContent value="social" className="mt-0">
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="p-4 space-y-4">
                <LinkedAccounts />
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/users/${user.id}`}>View public profile</Link>
                </Button>
                <div>
                  <p className="text-sm font-medium mb-2">Followers</p>
                  <div className="space-y-2">
                    {followers.length === 0 ? <p className="text-xs text-muted-foreground">No followers yet.</p> : followers.map((person) => (
                      <Link key={person.id} to={`/users/${person.id}`} className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted/40">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={person.avatarUrl} alt={person.name} />
                          <AvatarFallback>{person.name.split(' ').map((n) => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{person.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Following</p>
                  <div className="space-y-2">
                    {following.length === 0 ? <p className="text-xs text-muted-foreground">You are not following anyone yet.</p> : following.map((person) => (
                      <Link key={person.id} to={`/users/${person.id}`} className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted/40">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={person.avatarUrl} alt={person.name} />
                          <AvatarFallback>{person.name.split(' ').map((n) => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{person.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator />
        <div className="p-4 space-y-2">
          {/* Feature discovery links — For You, Lists, Compare */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            size="sm"
            onClick={() => { window.location.href = '/for-you'; }}
          >
            🎯 For You
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            size="sm"
            onClick={() => { window.location.href = '/lists'; }}
          >
            📚 My Reading Lists
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            size="sm"
            onClick={() => { window.location.href = '/compare'; }}
          >
            ⚖️ Compare Books
          </Button>
          <Separator />
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
