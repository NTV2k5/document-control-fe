'use client';

import { Move, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type PropsModalImage = {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  altText?: string;
};

export const ModalImage = ({ isOpen, onClose, imageUrl, altText }: PropsModalImage) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [fitToScreen, setFitToScreen] = useState(true);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const calculateFitScale = useCallback(() => {
    if (!containerRef.current || !imageDimensions.width || !imageDimensions.height) {
      return 1;
    }

    const container = containerRef.current.getBoundingClientRect();
    const containerWidth = container.width - 40; // padding
    const containerHeight = container.height - 40; // padding

    const scaleX = containerWidth / imageDimensions.width;
    const scaleY = containerHeight / imageDimensions.height;

    return Math.min(scaleX, scaleY, 1); // Don't scale up initially
  }, [imageDimensions]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  useEffect(() => {
    if (fitToScreen && imageDimensions.width && imageDimensions.height) {
      const fitScale = calculateFitScale();
      setScale(fitScale);
      setPosition({ x: 0, y: 0 });
    }
  }, [fitToScreen, imageDimensions, calculateFitScale]);

  const handleZoomIn = () => {
    setScale((prev) => {
      const newScale = Math.min(prev * 1.25, 5); // Max zoom 5x, smoother increment
      setFitToScreen(false);
      return newScale;
    });
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const newScale = Math.max(prev / 1.25, 0.1); // Min zoom 0.1x, smoother decrement
      return newScale;
    });
  };

  const handleFitToScreen = () => {
    setFitToScreen(true);
    setPosition({ x: 0, y: 0 });
  };

  const handleResetPosition = () => {
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= calculateFitScale()) {
      return;
    } // Only allow drag when zoomed
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) {
        return;
      }

      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setFitToScreen(true);
      setIsDragging(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const canDrag = scale > calculateFitScale();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      {/* Close button - top right */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-50 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
        aria-label="Close modal">
        <X className="size-6" />
      </button>

      {/* Zoom controls - bottom center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
        <button
          type="button"
          onClick={handleZoomOut}
          className="rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
          aria-label="Zoom out">
          <ZoomOut className="size-5" />
        </button>
        <button
          type="button"
          onClick={handleFitToScreen}
          className="rounded-full bg-black/50 px-3 py-2 text-sm text-white transition-colors hover:bg-black/70"
          title="Fit to screen">
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          className="rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
          aria-label="Zoom in">
          <ZoomIn className="size-5" />
        </button>
      </div>

      {/* Drag indicator */}
      {canDrag && (
        <button
          type="button"
          onClick={handleResetPosition}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-xs text-white transition-colors hover:bg-black/70 cursor-pointer"
          title="Click to reset position">
          <Move className="size-3" />
          <span>Drag to pan</span>
        </button>
      )}

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex size-full items-center justify-center overflow-hidden p-4"
        onClick={onClose}>
        <div
          className="relative flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          onMouseDown={handleMouseDown}
          onClick={(e) => e.stopPropagation()}>
          <img
            ref={imageRef}
            className="max-w-none transition-transform duration-200 select-none"
            width={imageDimensions.width || 800}
            height={imageDimensions.height || 600}
            style={{
              transform: `scale(${scale})`,
              maxWidth: 'none',
              maxHeight: 'none',
              width: 'auto',
              height: 'auto',
            }}
            alt={altText || 'image'}
            draggable={false}
            src={imageUrl}
            onLoad={handleImageLoad}
          />
        </div>
      </div>
    </div>
  );
};
