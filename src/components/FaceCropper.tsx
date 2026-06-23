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

        {/* Затемнение вокруг овала через SVG */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <mask id="oval-mask">
              <rect width="100" height="100" fill="white" />
              <ellipse
                cx={(rect.x + rect.w / 2) * 100}
                cy={(rect.y + rect.h / 2) * 100}
                rx={(rect.w / 2) * 100}
                ry={(rect.h / 2) * 100}
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100" height="100" fill="rgba(0,0,0,0.5)" mask="url(#oval-mask)" />
        </svg>

        {/* Овальная рамка */}
        <div
          onMouseDown={onMoveDown}
          onTouchStart={onMoveDown}
          className="absolute cursor-move"
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
            borderRadius: '50%',
            border: '3px solid hsl(var(--primary))',
            boxShadow: '0 0 0 1px hsl(var(--primary) / 0.3)',
          }}
        >
          <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
            Лицо ребёнка
          </span>

          {/* Хэндл ресайза — правый нижний край овала */}
          <div
            onMouseDown={onResizeDown}
            onTouchStart={onResizeDown}
            className="absolute cursor-se-resize flex items-center justify-center"
            style={{ bottom: '14%', right: '4%', width: 20, height: 20 }}
          >
            <div className="w-3.5 h-3.5 bg-primary rounded-full border-2 border-white shadow" />
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