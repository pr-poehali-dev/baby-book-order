import { useRef, useState, useEffect, useCallback } from 'react';

interface Rect { x: number; y: number; w: number; h: number }

interface FaceCropperProps {
  src: string;
  onCrop: (file: File) => void;
}

export default function FaceCropper({ src, onCrop }: FaceCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<Rect>({ x: 0.25, y: 0.1, w: 0.5, h: 0.6 });

  // Drag state
  const dragState = useRef<{ type: 'move' | 'resize'; mx: number; my: number; rect: Rect } | null>(null);

  const getContainerSize = () => {
    const el = containerRef.current;
    if (!el) return { w: 1, h: 1 };
    return { w: el.clientWidth, h: el.clientHeight };
  };

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const onMoveDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const mx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const my = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragState.current = { type: 'move', mx, my, rect: { ...rect } };
  };

  const onResizeDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const mx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const my = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragState.current = { type: 'resize', mx, my, rect: { ...rect } };
  };

  const onPointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragState.current) return;
    const mx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const my = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const { w: cw, h: ch } = getContainerSize();
    const dx = (mx - dragState.current.mx) / cw;
    const dy = (my - dragState.current.my) / ch;
    const base = dragState.current.rect;

    if (dragState.current.type === 'move') {
      setRect(r => ({
        ...r,
        x: clamp(base.x + dx, 0, 1 - base.w),
        y: clamp(base.y + dy, 0, 1 - base.h),
      }));
    } else {
      const newW = clamp(base.w + dx, 0.1, 1 - base.x);
      const newH = clamp(base.h + dy, 0.1, 1 - base.y);
      setRect(r => ({ ...r, w: newW, h: newH }));
    }
  }, []);

  const onPointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sx = rect.x * img.naturalWidth;
    const sy = rect.y * img.naturalHeight;
    const sw = rect.w * img.naturalWidth;
    const sh = rect.h * img.naturalHeight;

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCrop(new File([blob], 'face-crop.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden bg-black select-none"
        style={{ aspectRatio: '1 / 1' }}
      >
        <img
          ref={imgRef}
          src={src}
          alt="crop"
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />

        {/* Затемнение вокруг рамки */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `
            linear-gradient(to bottom,
              rgba(0,0,0,0.45) ${rect.y * 100}%,
              transparent ${rect.y * 100}%,
              transparent ${(rect.y + rect.h) * 100}%,
              rgba(0,0,0,0.45) ${(rect.y + rect.h) * 100}%
            )
          `
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `
            linear-gradient(to right,
              rgba(0,0,0,0.45) ${rect.x * 100}%,
              transparent ${rect.x * 100}%,
              transparent ${(rect.x + rect.w) * 100}%,
              rgba(0,0,0,0.45) ${(rect.x + rect.w) * 100}%
            )
          `
        }} />

        {/* Рамка */}
        <div
          onMouseDown={onMoveDown}
          onTouchStart={onMoveDown}
          className="absolute border-[3px] border-primary bg-primary/10 cursor-move rounded-lg"
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
          }}
        >
          <span className="absolute -top-7 left-0 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
            Лицо ребёнка
          </span>

          {/* Угловые метки */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary" />

          {/* Хэндл ресайза — правый нижний угол */}
          <div
            onMouseDown={onResizeDown}
            onTouchStart={onResizeDown}
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center"
          >
            <div className="w-3 h-3 bg-primary rounded-sm" />
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Перетащите рамку на лицо · тяните угол для изменения размера
      </p>

      <button
        type="button"
        onClick={handleConfirm}
        className="w-full py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
      >
        Подтвердить выделение
      </button>
    </div>
  );
}
