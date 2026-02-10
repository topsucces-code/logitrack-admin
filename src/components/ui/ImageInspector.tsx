import { useState, useCallback, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageItem { url: string; label: string; }
interface ImageInspectorProps { images: ImageItem[]; initialIndex: number; onClose: () => void; }

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const SCALE_STEP = 0.5;

export default function ImageInspector({ images, initialIndex, onClose }: ImageInspectorProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentImage = images[currentIndex];

  const resetTransforms = useCallback(() => { setScale(1); setRotation(0); }, []);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) { setCurrentIndex(prev => prev - 1); resetTransforms(); }
  }, [currentIndex, resetTransforms]);

  const goToNext = useCallback(() => {
    if (currentIndex < images.length - 1) { setCurrentIndex(prev => prev + 1); resetTransforms(); }
  }, [currentIndex, images.length, resetTransforms]);

  const handleZoomIn = useCallback(() => { setScale(prev => Math.min(MAX_SCALE, prev + SCALE_STEP)); }, []);
  const handleZoomOut = useCallback(() => { setScale(prev => Math.max(MIN_SCALE, prev - SCALE_STEP)); }, []);
  const handleRotate = useCallback(() => { setRotation(prev => (prev + 90) % 360); }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape': onClose(); break;
        case 'ArrowLeft': goToPrevious(); break;
        case 'ArrowRight': goToNext(); break;
        case '+': case '=': handleZoomIn(); break;
        case '-': handleZoomOut(); break;
        case 'r': handleRotate(); break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrevious, goToNext, handleZoomIn, handleZoomOut, handleRotate]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scale > 1) return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, [scale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || scale > 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    if (deltaX > 60) goToPrevious();
    else if (deltaX < -60) goToNext();
    touchStartRef.current = null;
  }, [scale, goToPrevious, goToNext]);

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black/90 z-[60] flex flex-col select-none" onClick={onClose}>
      <div className="flex items-center justify-between px-3 py-2.5 bg-black/60" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm text-white font-medium truncate">{currentImage.label}</p>
          {images.length > 1 && <span className="text-xs text-white/60 flex-shrink-0">{currentIndex + 1} / {images.length}</span>}
        </div>
        <button onClick={onClose} className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0" title="Fermer"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onClick={onClose}>
        {images.length > 1 && currentIndex > 0 && <button onClick={(e) => { e.stopPropagation(); goToPrevious(); }} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors" title="Image precedente"><ChevronLeft className="w-5 h-5" /></button>}
        <img src={currentImage.url} alt={currentImage.label} className="max-w-full max-h-full object-contain transition-transform duration-200 ease-out" style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }} onClick={(e) => e.stopPropagation()} draggable={false} />
        {images.length > 1 && currentIndex < images.length - 1 && <button onClick={(e) => { e.stopPropagation(); goToNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors" title="Image suivante"><ChevronRight className="w-5 h-5" /></button>}
      </div>
      <div className="flex items-center justify-center gap-2 px-3 py-2.5 bg-black/60" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleZoomOut} disabled={scale <= MIN_SCALE} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Dezoomer"><ZoomOut className="w-5 h-5" /></button>
        <span className="text-xs text-white/70 min-w-[3rem] text-center font-medium">{Math.round(scale * 100)}%</span>
        <button onClick={handleZoomIn} disabled={scale >= MAX_SCALE} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Zoomer"><ZoomIn className="w-5 h-5" /></button>
        <div className="w-px h-5 bg-white/20 mx-1" />
        <button onClick={handleRotate} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Pivoter"><RotateCw className="w-5 h-5" /></button>
        {rotation !== 0 && <span className="text-xs text-white/50">{rotation}&deg;</span>}
      </div>
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 px-3 pb-3 bg-black/60" onClick={(e) => e.stopPropagation()}>
          {images.map((img, index) => (
            <button key={index} onClick={() => { setCurrentIndex(index); resetTransforms(); }} className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-colors flex-shrink-0 ${index === currentIndex ? 'border-white' : 'border-transparent opacity-50 hover:opacity-80'}`} title={img.label}>
              <img src={img.url} alt={img.label} className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
