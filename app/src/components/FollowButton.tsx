import { useEffect, useState } from 'react';
import { Loader2, UserPlus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { ApiError, socialUsersApi } from '@/api/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FollowButtonProps {
  userId: string;
  initialFollowing?: boolean;
  initialFollowerCount?: number;
  className?: string;
  size?: 'sm' | 'default';
  testId?: string;
  onChange?: (state: { following: boolean; followerCount: number }) => void;
}

export function FollowButton({
  userId,
  initialFollowing = false,
  initialFollowerCount = 0,
  className,
  size = 'sm',
  testId = 'follow-button',
  onChange,
}: FollowButtonProps) {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [following, setFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [hovered, setHovered] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  useEffect(() => {
    setFollowerCount(initialFollowerCount);
  }, [initialFollowerCount]);

  if (user?.id === userId) {
    return null;
  }

  async function handleClick() {
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }

    setLoading(true);
    try {
      const response = following
        ? await socialUsersApi.unfollow(userId)
        : await socialUsersApi.follow(userId);

      setHovered(false);
      setFollowing(response.following);
      setFollowerCount(response.followerCount);
      onChange?.({ following: response.following, followerCount: response.followerCount });
      toast.success(response.following ? 'User followed' : 'User unfollowed');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update follow state';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const label = following ? (hovered ? 'Unfollow' : 'Following') : 'Follow';

  return (
    <Button
      type="button"
      size={size}
      variant={following ? 'secondary' : 'default'}
      aria-pressed={following}
      data-testid={testId}
      className={cn('gap-2', className)}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => void handleClick()}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : following ? (
        <UserCheck className="h-4 w-4" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      <span>{label}</span>
      <span className="text-xs opacity-80">{followerCount}</span>
    </Button>
  );
}
