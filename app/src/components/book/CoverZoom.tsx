import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { coverImagesApi, type BookImageResponse } from '@/api/client';
import { handleImgError } from '@/lib/imageUtils';

interface CoverZoomProps {
  bookId: string;
  title: string;
  fallbackCoverImage: string;
}

function distanceBetweenTouches(touches: React.TouchList) {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function zoomClass(scale: number) {
  if (scale >= 3.75) return 'scale-[4]';
  if (scale >= 3.25) return 'scale-[3.5]';
  if (scale >= 2.75) return 'scale-[3]';
  if (scale >= 2.25) return 'scale-[2.5]';
  if (scale >= 1.75) return 'scale-[2]';
  if (scale >= 1.25) return 'scale-150';
  return 'scale-100';
}

export function CoverZoom({ bookId, title, fallbackCoverImage }: CoverZoomProps) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<BookImageResponse[]>([]);
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(false);
  const [startX, setStartX] = useState<number | null>(null);
  const [pinchDistance, setPinchDistance] = useState(0);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    coverImagesApi.list(bookId)
      .then((res) => {
        const next = (res.images || []).length > 0
          ? res.images
          : [{ id: 'main-cover', url: fallbackCoverImage, type: 'cover_front', altText: `${title} cover`, displayOrder: 0 }];
        setImages(next);
        setIndex(0);
      })
      .catch(() => {
        setImages([{ id: 'main-cover', url: fallbackCoverImage, type: 'cover_front', altText: `${title} cover`, displayOrder: 0 }]);
        setIndex(0);
      })
      .finally(() => setLoading(false));
  }, [open, bookId, fallbackCoverImage, title]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowRight') setIndex((prev) => (prev + 1) % Math.max(1, images.length));
      if (e.key === 'ArrowLeft') setIndex((prev) => (prev - 1 + Math.max(1, images.length)) % Math.max(1, images.length));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, images.length]);

  useEffect(() => {
    if (!open) {
      setScale(1);
      return;
    }
    modalRef.current?.focus();
  }, [open]);

  const activeImage = useMemo(() => {
    if (images.length === 0) {
      return { id: 'main-cover', url: fallbackCoverImage, type: 'cover_front', altText: `${title} cover`, displayOrder: 0 };
    }
    return images[index] || images[0];
  }, [images, index, fallbackCoverImage, title]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative aspect-[2/3] overflow-hidden rounded-xl shadow-2xl group cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="cover-zoom-trigger"
        aria-label={`Zoom cover for ${title}`}
      >
        <img src={fallbackCoverImage} alt={`${title} cover`} className="h-full w-full object-cover" onError={handleImgError} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" aria-hidden="true" />
        <span className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-1 text-xs font-medium inline-flex items-center gap-1">
          <ZoomIn className="h-3.5 w-3.5" />
          Zoom
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          data-testid="cover-zoom-backdrop"
        >
          <div
            className="relative w-full max-w-5xl h-[90vh] rounded-xl border bg-background overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Cover zoom gallery"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            ref={modalRef}
            data-testid="cover-zoom-modal"
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute top-3 right-3 z-10"
              onClick={() => setOpen(false)}
              data-testid="cover-zoom-close"
              aria-label="Close cover zoom"
            >
              <X className="h-4 w-4" />
            </Button>

            <div
              className="w-full h-full flex items-center justify-center bg-black/95"
              onWheel={(e) => {
                e.preventDefault();
                const next = e.deltaY < 0 ? scale + 0.15 : scale - 0.15;
                setScale(Math.max(1, Math.min(4, Number(next.toFixed(2)))));
              }}
              onTouchStart={(e) => {
                if (e.touches.length === 2) {
                  setPinchDistance(distanceBetweenTouches(e.touches));
                  return;
                }
                if (e.touches.length === 1) {
                  setStartX(e.touches[0].clientX);
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 2) {
                  const nextDistance = distanceBetweenTouches(e.touches);
                  if (pinchDistance > 0) {
                    const ratio = nextDistance / pinchDistance;
                    const nextScale = Math.max(1, Math.min(4, Number((scale * ratio).toFixed(2))));
                    setScale(nextScale);
                  }
                  setPinchDistance(nextDistance);
                }
              }}
              onTouchEnd={(e) => {
                if (e.touches.length === 0) {
                  setPinchDistance(0);
                }

                if (startX !== null && e.changedTouches.length > 0 && images.length > 1 && scale <= 1.05) {
                  const deltaX = e.changedTouches[0].clientX - startX;
                  if (deltaX <= -50) setIndex((prev) => (prev + 1) % images.length);
                  if (deltaX >= 50) setIndex((prev) => (prev - 1 + images.length) % images.length);
                  setStartX(null);
                }
              }}
            >
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading gallery...</p>
              ) : (
                <img
                  src={activeImage.url}
                  alt={activeImage.altText || `${title} cover image`}
                  className={`max-w-full max-h-full object-contain select-none transition-transform duration-100 ${zoomClass(scale)}`}
                  data-testid="cover-zoom-image"
                />
              )}
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2" data-testid="cover-zoom-dots">
              {images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  className={`h-2.5 w-2.5 rounded-full border ${i === index ? 'bg-primary border-primary' : 'bg-muted border-muted-foreground/30'}`}
                  onClick={() => {
                    setIndex(i);
                    setScale(1);
                  }}
                  aria-label={`View image ${i + 1}`}
                  data-testid="cover-zoom-dot"
                />
              ))}
            </div>

            <p className="absolute bottom-4 right-4 text-xs text-background/80 bg-black/50 rounded px-2 py-1 sm:hidden" data-testid="cover-zoom-pinch-hint">
              Pinch to zoom
            </p>
          </div>
        </div>
      )}
    </>
  );
}
