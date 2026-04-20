import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, BookOpen, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { authorsApi } from '@/api/client';

interface AuthorData {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  bio?: string;
  bookCount?: number;
  followerCount?: number;
  isFollowed?: boolean;
}

interface AuthorSectionProps {
  authors: AuthorData[];
}

const BIO_LINE_LIMIT = 3;
const BIO_CHAR_LIMIT = 200;

export function AuthorSection({ authors }: AuthorSectionProps) {
  if (!authors || authors.length === 0) return null;

  return (
    <section data-testid="author-section" aria-label="About the Author">
      <h3 className="text-xl font-semibold mb-4">About the Author</h3>
      <div className="space-y-4">
        {authors.map((author) => (
          <AuthorCard key={author.id} author={author} />
        ))}
      </div>
    </section>
  );
}

function AuthorCard({ author }: { author: AuthorData }) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(author.isFollowed ?? false);
  const [followerCount, setFollowerCount] = useState(author.followerCount ?? 0);
  const [loading, setLoading] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  const isBioLong = (author.bio?.length ?? 0) > BIO_CHAR_LIMIT;
  const displayBio = bioExpanded || !isBioLong
    ? author.bio
    : author.bio?.slice(0, BIO_CHAR_LIMIT) + '…';

  const handleFollowToggle = async () => {
    if (!user || loading) return;
    setLoading(true);

    // Optimistic update
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowerCount((c) => (wasFollowing ? c - 1 : c + 1));

    try {
      const result = wasFollowing
        ? await authorsApi.unfollow(author.id)
        : await authorsApi.follow(author.id);
      setIsFollowing(result.following);
      setFollowerCount(result.followerCount);
    } catch {
      // Revert on error
      setIsFollowing(wasFollowing);
      setFollowerCount((c) => (wasFollowing ? c + 1 : c - 1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="author-card"
      className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg border bg-card"
    >
      {/* Author Photo */}
      <Link to={`/author/${author.slug}`} className="shrink-0 self-center sm:self-start">
        {author.imageUrl ? (
          <img
            src={author.imageUrl}
            alt={author.name}
            data-testid="author-photo"
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <div
            data-testid="author-photo-placeholder"
            className="w-20 h-20 rounded-full bg-muted flex items-center justify-center"
            aria-label={`${author.name} photo placeholder`}
          >
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </Link>

      {/* Author Info */}
      <div className="flex-1 min-w-0 text-center sm:text-left">
        <Link
          to={`/author/${author.slug}`}
          data-testid="author-name-link"
          className="text-lg font-semibold text-primary hover:underline"
        >
          {author.name}
        </Link>

        {/* Stats */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1" data-testid="author-book-count">
            <BookOpen className="h-3.5 w-3.5" />
            {author.bookCount ?? 0} {(author.bookCount ?? 0) === 1 ? 'book' : 'books'}
          </span>
          <span className="flex items-center gap-1" data-testid="author-follower-count">
            <Users className="h-3.5 w-3.5" />
            {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
          </span>
        </div>

        {/* Bio */}
        {author.bio ? (
          <div className="mt-2">
            <AnimatePresence mode="wait">
              <motion.p
                key={bioExpanded ? 'full' : 'truncated'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-sm text-muted-foreground leading-relaxed"
                data-testid="author-bio"
              >
                {displayBio}
              </motion.p>
            </AnimatePresence>
            {isBioLong && (
              <button
                onClick={() => setBioExpanded(!bioExpanded)}
                className="text-sm text-primary hover:underline mt-1 inline-flex items-center gap-0.5"
                data-testid="author-bio-toggle"
              >
                {bioExpanded ? (
                  <>Show less <ChevronUp className="h-3.5 w-3.5" /></>
                ) : (
                  <>Show more <ChevronDown className="h-3.5 w-3.5" /></>
                )}
              </button>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground italic" data-testid="author-no-bio">
            No bio available
          </p>
        )}

        {/* Follow Button */}
        {user ? (
          <Button
            variant={isFollowing ? 'secondary' : 'default'}
            size="sm"
            className="mt-3"
            onClick={handleFollowToggle}
            disabled={loading}
            aria-label={isFollowing ? `Unfollow ${author.name}` : `Follow ${author.name}`}
            data-testid="author-follow-btn"
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
