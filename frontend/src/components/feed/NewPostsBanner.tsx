import { useEffect, useState } from 'react';
import { ArrowUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NewPostsBannerProps {
  visible: boolean;
  count: number;
  onClick: () => void;
  onDismiss?: () => void;
}

const NewPostsBanner = ({
  visible,
  count,
  onClick,
  onDismiss,
}: NewPostsBannerProps) => {
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      const t = requestAnimationFrame(() => setAnimateIn(true));
      return () => cancelAnimationFrame(t);
    }
    if (!visible && mounted) {
      setAnimateIn(false);
      const t = setTimeout(() => setMounted(false), 240);
      return () => clearTimeout(t);
    }
  }, [visible, mounted]);

  if (!mounted) return null;

  const label =
    count > 1 ? (
      <>
        <span className="font-semibold">{count}</span>
        <span className="ml-1">{count === 1 ? 'New Post' : 'New Posts'}</span>
      </>
    ) : (
      <span>New posts available</span>
    );

  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 pointer-events-none">
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-2 rounded-full shadow-lg border border-border/60 bg-card/90 backdrop-blur-md px-4 py-2 pl-5',
          'transition-all duration-200 ease-out',
          animateIn
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 -translate-y-3 scale-95',
        )}
        role="status"
        aria-live="polite"
      >
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'group flex items-center gap-2 text-sm font-medium text-foreground/90',
            'hover:text-primary transition-colors',
          )}
        >
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary',
              'transition-transform duration-500 group-hover:-translate-y-0.5',
              'animate-[bounce_2s_ease-in-out_infinite]',
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </span>
          {label}
        </button>
        {onDismiss && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="Dismiss new posts banner"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default NewPostsBanner;
