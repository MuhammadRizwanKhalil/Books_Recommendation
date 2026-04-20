import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, MessageSquare, PenSquare, ShieldAlert, UserCheck } from 'lucide-react';
import { authorsApi, type AuthorPortalDashboardResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function AuthorPortal() {
  const { user, openAuthModal } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<AuthorPortalDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bio, setBio] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [instagram, setInstagram] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [publishingPost, setPublishingPost] = useState(false);

  const [reviewReplyDrafts, setReviewReplyDrafts] = useState<Record<string, string>>({});

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const data = await authorsApi.getPortalDashboard();
      setDashboard(data);
      setBio(data.author.bio || '');
      setImageUrl(data.author.imageUrl || '');
      setWebsite(data.author.website || '');
      setTwitter(data.author.socialLinks.twitter || '');
      setInstagram(data.author.socialLinks.instagram || '');
    } catch (err: any) {
      setError(err?.message || 'Failed to load author portal');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void loadDashboard();
  }, [user]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await authorsApi.updatePortalProfile({
        bio,
        imageUrl,
        website,
        socialLinks: {
          twitter,
          instagram,
        },
      });
      toast.success('Author profile updated');
      await loadDashboard();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function publishPost() {
    if (!postTitle.trim() || !postContent.trim()) {
      toast.error('Title and content are required');
      return;
    }

    setPublishingPost(true);
    try {
      await authorsApi.createPortalPost({
        title: postTitle.trim(),
        content: postContent.trim(),
      });
      setPostTitle('');
      setPostContent('');
      toast.success('Author update published');
      await loadDashboard();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to publish post');
    } finally {
      setPublishingPost(false);
    }
  }

  async function submitReviewResponse(reviewId: string) {
    const draft = (reviewReplyDrafts[reviewId] || '').trim();
    if (!draft) {
      toast.error('Response is required');
      return;
    }

    try {
      await authorsApi.respondToReview(reviewId, draft);
      toast.success('Review response saved');
      setReviewReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }));
      await loadDashboard();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to respond to review');
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto" data-testid="author-portal-unauthenticated">
          <CardHeader>
            <CardTitle>Author Portal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Please sign in to access the author portal.</p>
            <Button onClick={() => openAuthModal('signin')}>Sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16" data-testid="author-portal-loading">
        <p className="text-sm text-muted-foreground">Loading author portal...</p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto" data-testid="author-portal-forbidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Author Portal Access Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error || 'You need an approved author claim to access this portal.'}</p>
            <Button asChild variant="outline">
              <Link to="/">Back to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6" data-testid="author-portal-page">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Author Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile, publish updates, and respond to reader reviews.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Books</p>
            <p className="text-2xl font-bold">{dashboard.stats.totalBooks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Reviews</p>
            <p className="text-2xl font-bold">{dashboard.stats.totalReviews}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Average Rating</p>
            <p className="text-2xl font-bold">{dashboard.stats.avgRating.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Views</p>
            <p className="text-2xl font-bold">{dashboard.stats.totalViews}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Followers</p>
            <p className="text-2xl font-bold">{dashboard.stats.followerCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5" />Profile Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="author-portal-image-url">Photo URL</Label>
              <Input id="author-portal-image-url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} data-testid="author-portal-image-url" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author-portal-website">Website</Label>
              <Input id="author-portal-website" value={website} onChange={(e) => setWebsite(e.target.value)} data-testid="author-portal-website" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author-portal-twitter">Twitter / X</Label>
              <Input id="author-portal-twitter" value={twitter} onChange={(e) => setTwitter(e.target.value)} data-testid="author-portal-twitter" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author-portal-instagram">Instagram</Label>
              <Input id="author-portal-instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} data-testid="author-portal-instagram" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="author-portal-bio">Bio</Label>
            <Textarea id="author-portal-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} data-testid="author-portal-bio" />
          </div>
          <Button variant="secondary" onClick={saveProfile} disabled={savingProfile} data-testid="author-portal-save-profile">
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PenSquare className="h-5 w-5" />Publish Author Update</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="author-portal-post-title" className="sr-only">Update title</Label>
          <Input id="author-portal-post-title" placeholder="Update title" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} data-testid="author-portal-post-title" />
          <Label htmlFor="author-portal-post-content" className="sr-only">Update content</Label>
          <Textarea id="author-portal-post-content" rows={4} placeholder="Share an announcement with readers" value={postContent} onChange={(e) => setPostContent(e.target.value)} data-testid="author-portal-post-content" />
          <Button variant="secondary" onClick={publishPost} disabled={publishingPost} data-testid="author-portal-publish-post">
            {publishingPost ? 'Publishing...' : 'Publish Update'}
          </Button>

          {dashboard.posts.length > 0 && (
            <div className="pt-2 space-y-2" data-testid="author-portal-posts-list">
              {dashboard.posts.slice(0, 5).map((post) => (
                <div key={post.id} className="border rounded-md p-3">
                  <p className="font-medium text-sm">{post.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(post.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Recent Reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4" data-testid="author-portal-reviews-list">
          {dashboard.recentReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            dashboard.recentReviews.map((review) => (
              <div key={review.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm font-medium">
                    <Link to={`/book/${review.bookSlug}`} className="hover:text-primary">{review.bookTitle}</Link>
                  </div>
                  <Badge variant="secondary">{review.rating.toFixed(1)} / 5</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{review.userName}</p>
                <p className="text-sm text-muted-foreground">{review.content}</p>

                {review.authorResponse?.content ? (
                  <div className="rounded-md bg-muted p-2" data-testid={`author-portal-response-${review.id}`}>
                    <p className="text-xs font-semibold">Your response</p>
                    <p className="text-sm text-foreground">{review.authorResponse.content}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      rows={2}
                      placeholder="Write a response as the author"
                      value={reviewReplyDrafts[review.id] || ''}
                      onChange={(e) => setReviewReplyDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                      data-testid={`author-portal-review-reply-${review.id}`}
                    />
                    <Button
                      size="sm"
                      onClick={() => submitReviewResponse(review.id)}
                      data-testid={`author-portal-review-submit-${review.id}`}
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Publish Response
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AuthorPortal;
