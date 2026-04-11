import { cn } from '@/lib/utils';

interface LogoMarkProps {
  className?: string;
  size?: number;
}

/**
 * The Book Times brand mark — a distinctive open book icon with page lines.
 * Uses currentColor so it adapts to any container/theme automatically.
 */
export function LogoMark({ className, size = 32 }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      {/* Left page */}
      <path
        d="M16 5C13.5 4.2 9 4.5 4.5 6L4.5 25.5C9 24 13.5 23.8 16 25Z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right page */}
      <path
        d="M16 5C18.5 4.2 23 4.5 27.5 6L27.5 25.5C23 24 18.5 23.8 16 25Z"
        fill="currentColor"
        fillOpacity="0.06"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left page text lines */}
      <line x1="7.5" y1="11" x2="13.5" y2="11.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.35" strokeLinecap="round" />
      <line x1="7.5" y1="14.5" x2="13.5" y2="15" stroke="currentColor" strokeWidth="1" strokeOpacity="0.35" strokeLinecap="round" />
      <line x1="7.5" y1="18" x2="11.5" y2="18.3" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" strokeLinecap="round" />
      {/* Right page text lines */}
      <line x1="18.5" y1="11.5" x2="24.5" y2="11" stroke="currentColor" strokeWidth="1" strokeOpacity="0.35" strokeLinecap="round" />
      <line x1="18.5" y1="15" x2="24.5" y2="14.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.35" strokeLinecap="round" />
      <line x1="20.5" y1="18.3" x2="24.5" y2="18" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" strokeLinecap="round" />
    </svg>
  );
}

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizeConfig = {
  xs: { icon: 20, text: 'text-sm', gap: 'gap-1.5' },
  sm: { icon: 28, text: 'text-base', gap: 'gap-2' },
  md: { icon: 36, text: 'text-xl', gap: 'gap-2.5' },
  lg: { icon: 44, text: 'text-2xl', gap: 'gap-3' },
  xl: { icon: 56, text: 'text-4xl', gap: 'gap-4' },
};

/**
 * Full logo: icon + "The Book Times" wordmark.
 */
export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const config = sizeConfig[size];

  return (
    <div className={cn('flex items-center', config.gap, className)}>
      <LogoMark size={config.icon} />
      {showText && (
        <span className={cn('font-serif font-bold tracking-tight leading-tight', config.text)}>
          The Book Times
        </span>
      )}
    </div>
  );
}
