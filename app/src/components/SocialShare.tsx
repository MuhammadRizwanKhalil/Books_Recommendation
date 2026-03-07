import { Twitter, Facebook, Linkedin, Link2, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SocialShareProps {
  url: string;
  title: string;
  description?: string;
  className?: string;
  variant?: 'icons' | 'full';
}

export function SocialShare({ url, title, description, className, variant = 'icons' }: SocialShareProps) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description || title);

  const shareLinks = [
    {
      name: 'Twitter',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: 'hover:bg-sky-100 hover:text-sky-600 dark:hover:bg-sky-950',
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: 'hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-950',
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: 'hover:bg-sky-100 hover:text-sky-700 dark:hover:bg-sky-950',
    },
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      url: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      color: 'hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-950',
    },
    {
      name: 'Email',
      icon: Mail,
      url: `mailto:?subject=${encodedTitle}&body=${encodedDesc}%0A%0A${encodedUrl}`,
      color: 'hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-950',
    },
  ];

  const copyLink = () => {
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard!');
    });
  };

  if (variant === 'full') {
    return (
      <div className={className}>
        <p className="text-sm font-medium mb-3">Share this book</p>
        <div className="flex flex-wrap gap-2">
          {shareLinks.map((link) => (
            <Button
              key={link.name}
              variant="outline"
              size="sm"
              asChild
              className={link.color}
            >
              <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${link.name}`}>
                <link.icon className="h-4 w-4 mr-2" />
                {link.name}
              </a>
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={copyLink} className="hover:bg-muted">
            <Link2 className="h-4 w-4 mr-2" />
            Copy Link
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        {shareLinks.map((link) => (
          <Button
            key={link.name}
            variant="ghost"
            size="icon"
            asChild
            className={`h-8 w-8 ${link.color}`}
          >
            <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${link.name}`}>
              <link.icon className="h-4 w-4" />
            </a>
          </Button>
        ))}
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={copyLink} aria-label="Copy link">
          <Link2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
