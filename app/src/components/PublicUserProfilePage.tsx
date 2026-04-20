import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, Clock3, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FollowButton } from '@/components/FollowButton';
import { readingStatsApi, socialUsersApi, type SocialUserProfileResponse, type SocialUserSummaryResponse } from '@/api/client';
import { useSEO } from '@/hooks/useSEO';
import { formatDate } from '@/lib/utils';

function UserList({ users, emptyMessage, testId }: { users: SocialUserSummaryResponse[]; emptyMessage: string; testId: string }) {
  return (
    <div className="space-y-3" data-testid={testId}>
      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        users.map((person) => (
          <Link key={person.id} to={`/users/${person.id}`} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors">
            <Avatar className="h-10 w-10">
              <AvatarImage src={person.avatarUrl || ''} alt={person.name} />
              <AvatarFallback>{person.name.split(' ').map((part) => part[0]).join('')}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium truncate">{person.name}</p>
              <p className="text-xs text-muted-foreground">{person.reviewCount || 0} reviews</p>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}

export function PublicUserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<SocialUserProfileResponse | null>(null);
  const [followers, setFollowers] = useState<SocialUserSummaryResponse[]>([]);
  const [following, setFollowing] = useState<SocialUserSummaryResponse[]>([]);
  const [stats, setStats] = useState<{ booksRead: number; pagesRead: number; streak?: { currentDays: number } } | null>(null);
  const [loading, setLoading] = useState(true);

  useSEO({
    title: profile ? `${profile.name} | The Book Times` : 'Reader Profile | The Book Times',
    description: profile ? `See ${profile.name}'s reading profile, followers, and social activity.` : 'Reader profile on The Book Times.',
  });

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    Promise.all([
      socialUsersApi.getProfile(id),
      socialUsersApi.getFollowers(id),
      socialUsersApi.getFollowing(id),
      readingStatsApi.getPublicStats(id).catch(() => null),
    ])
      .then(([profileRes, followersRes, followingRes, statsRes]) => {
        setProfile(profileRes);
        setFollowers(followersRes.users || []);
        setFollowing(followingRes.users || []);
        setStats(statsRes);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 pb-16">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-10 rounded bg-muted animate-pulse" />
          <div className="h-48 rounded-xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8 pb-16 text-center">
        <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
        <h1 className="text-2xl font-bold">Reader not found</h1>
        <p className="text-muted-foreground mt-2">This profile could not be loaded.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-16" data-testid="user-profile-page">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatarUrl || ''} alt={profile.name} />
                <AvatarFallback>{profile.name.split(' ').map((part) => part[0]).join('')}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold truncate">{profile.name}</h1>
                <p className="text-sm text-muted-foreground">Member since {formatDate(profile.createdAt)}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">{profile.reviewCount || 0} reviews</Badge>
                  <Badge variant="outline">{profile.booksRead || stats?.booksRead || 0} books read</Badge>
                </div>
              </div>
            </div>
            <FollowButton
              userId={profile.id}
              initialFollowing={profile.isFollowing}
              initialFollowerCount={profile.followerCount}
              className="w-full md:w-auto"
              onChange={({ following: isFollowing, followerCount }) => {
                setProfile((prev) => prev ? { ...prev, isFollowing, followerCount } : prev);
                socialUsersApi.getFollowers(profile.id).then((res) => setFollowers(res.users || [])).catch(() => undefined);
                socialUsersApi.getFollowing(profile.id).then((res) => setFollowing(res.users || [])).catch(() => undefined);
              }}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <button type="button" className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xl font-bold">{profile.followerCount}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </button>
            <button type="button" className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xl font-bold">{profile.followingCount}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </button>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xl font-bold">{stats?.pagesRead || 0}</p>
              <p className="text-xs text-muted-foreground">Pages read</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xl font-bold">{stats?.streak?.currentDays || 0}</p>
              <p className="text-xs text-muted-foreground">Day streak</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="followers" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full md:w-80">
            <TabsTrigger value="followers">Followers</TabsTrigger>
            <TabsTrigger value="following">Following</TabsTrigger>
          </TabsList>

          <TabsContent value="followers" className="space-y-3">
            <UserList users={followers} emptyMessage="No followers yet." testId="followers-list" />
          </TabsContent>

          <TabsContent value="following" className="space-y-3">
            <UserList users={following} emptyMessage="Not following anyone yet." testId="following-list" />
          </TabsContent>
        </Tabs>

        <div className="rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Clock3 className="h-5 w-5 text-primary" />
            Reading snapshot
          </h2>
          <p className="text-sm text-muted-foreground">
            Social reading activity builds here and powers the community feed.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button asChild variant="outline">
              <Link to="/for-you">
                <BookOpen className="h-4 w-4 mr-2" /> Explore books
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
