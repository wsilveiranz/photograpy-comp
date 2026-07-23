import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import './lightbox.css';

export interface LightboxItem {
  id: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface LightboxProps {
  items: LightboxItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Optional actions (e.g. a vote button) rendered for the current item. */
  renderActions?: (item: LightboxItem, index: number) => ReactNode;
}

export function Lightbox({ items, index, onIndexChange, onClose, renderActions }: LightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const total = items.length;
  const current = items[index];

  const goTo = useCallback(
    (next: number) => {
      if (total === 0) {
        return;
      }
      onIndexChange((next + total) % total);
    },
    [onIndexChange, total],
  );

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'ArrowRight':
          event.preventDefault();
          goTo(index + 1);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          goTo(index - 1);
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goTo, index, onClose]);

  if (!current) {
    return null;
  }

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${total}`}
      ref={dialogRef}
      tabIndex={-1}
      onClick={onClose}
    >
      <div className="lightbox__bar" onClick={(event) => event.stopPropagation()}>
        <span className="lightbox__counter" aria-live="polite">
          {index + 1} of {total}
        </span>
        <button type="button" className="lightbox__close" onClick={onClose}>
          Close
        </button>
      </div>

      <button
        type="button"
        className="lightbox__nav lightbox__nav--prev"
        onClick={(event) => {
          event.stopPropagation();
          goTo(index - 1);
        }}
        disabled={total <= 1}
        aria-label="Previous photo"
      >
        <span aria-hidden="true">‹</span>
      </button>

      <figure className="lightbox__figure" onClick={(event) => event.stopPropagation()}>
        <img
          className="lightbox__image"
          src={current.url}
          alt={current.alt ?? `Photo ${index + 1} of ${total}`}
          width={current.width}
          height={current.height}
        />
        {renderActions && <figcaption className="lightbox__actions">{renderActions(current, index)}</figcaption>}
      </figure>

      <button
        type="button"
        className="lightbox__nav lightbox__nav--next"
        onClick={(event) => {
          event.stopPropagation();
          goTo(index + 1);
        }}
        disabled={total <= 1}
        aria-label="Next photo"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
