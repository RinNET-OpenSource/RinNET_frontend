import type {
  HTMLAttributes,
  MouseEvent,
  MouseEventHandler,
  ReactNode,
  TouchEvent,
  TouchEventHandler,
  TransitionEventHandler,
} from 'react';
import { cn } from '@/lib/utils';
import './ongeki-interactive-card.css';

export interface OngekiInteractiveCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>,
    | 'children'
    | 'className'
    | 'onClick'
    | 'onContextMenu'
    | 'onMouseLeave'
    | 'onMouseMove'
    | 'onTouchCancel'
    | 'onTouchEnd'
    | 'onTouchMove'
    | 'onTransitionEnd'> {
  children: ReactNode;
  className?: string;
  /** Disables tilt/shine input and click forwarding while keeping the card visible. */
  disabled?: boolean;
  /** Enables the legacy pseudo-3D interaction. Defaults to true. */
  interactive?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  onMouseMove?: MouseEventHandler<HTMLDivElement>;
  onTouchCancel?: TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: TouchEventHandler<HTMLDivElement>;
  onTouchMove?: TouchEventHandler<HTMLDivElement>;
  onTransitionEnd?: TransitionEventHandler<HTMLDivElement>;
}

function setCustomProperty(element: HTMLElement, name: string, value: string) {
  element.style.setProperty(name, value);
}

export function resetOngekiInteractiveCardTilt(element: HTMLElement) {
  element.style.removeProperty('--rotator-rotate-x');
  element.style.removeProperty('--rotator-rotate-y');
  element.style.removeProperty('--rotator-transition');
  setCustomProperty(element, '--pseudo-left', '50%');
  setCustomProperty(element, '--pseudo-top', '50%');
  setCustomProperty(element, '--pseudo-opacity', '0');
}

function updateTilt(element: HTMLElement, clientX: number, clientY: number) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const rotateX = (centerY - y) / (rect.width / 32);
  const rotateY = (x - centerX) / (rect.height / 32);
  setCustomProperty(element, '--rotator-rotate-x', `${rotateX}deg`);
  setCustomProperty(element, '--rotator-rotate-y', `${rotateY}deg`);

  const max = Math.sqrt(centerX * centerX + centerY * centerY);
  const dx = (x - centerX) / max;
  const dy = (y - centerY) / max;
  const distance = Math.sqrt(dx * dx + dy * dy);
  setCustomProperty(element, '--rotator-transition', 'all 0s ease-out');
  setCustomProperty(element, '--pseudo-left', `${(x / rect.width) * 100}%`);
  setCustomProperty(element, '--pseudo-top', `${(y / rect.height) * 100}%`);
  setCustomProperty(element, '--pseudo-opacity', String(Math.min(1, distance)));
}

/**
 * Shared seam for every Ongeki card surface.
 *
 * The wrapper owns the legacy `.cards-col` perspective and all pointer/touch
 * tilt variables, while callers only provide content and interaction callbacks.
 */
export function OngekiInteractiveCard({
  children,
  className,
  disabled = false,
  interactive = true,
  onClick,
  onContextMenu,
  onMouseLeave,
  onMouseMove,
  onTouchCancel,
  onTouchEnd,
  onTouchMove,
  onTransitionEnd,
  style,
  ...rest
}: OngekiInteractiveCardProps) {
  const enabled = interactive && !disabled;

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (enabled) updateTilt(event.currentTarget, event.clientX, event.clientY);
    onMouseMove?.(event);
  }

  function handleMouseLeave(event: MouseEvent<HTMLDivElement>) {
    if (enabled) resetOngekiInteractiveCardTilt(event.currentTarget);
    onMouseLeave?.(event);
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (enabled) {
      const touch = event.touches[0];
      if (touch) {
        updateTilt(event.currentTarget, touch.clientX, touch.clientY);
        if (event.cancelable) event.preventDefault();
      }
    }
    onTouchMove?.(event);
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (enabled) resetOngekiInteractiveCardTilt(event.currentTarget);
    onTouchEnd?.(event);
  }

  function handleTouchCancel(event: TouchEvent<HTMLDivElement>) {
    if (enabled) resetOngekiInteractiveCardTilt(event.currentTarget);
    onTouchCancel?.(event);
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!disabled) {
      if (enabled) resetOngekiInteractiveCardTilt(event.currentTarget);
      onClick?.(event);
    }
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    if (!disabled) onContextMenu?.(event);
  }

  return (
    <div
      {...rest}
      className={cn('cards-col', className)}
      style={style}
      aria-disabled={disabled || undefined}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onTouchCancel={handleTouchCancel}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTransitionEnd={onTransitionEnd}
    >
      {children}
    </div>
  );
}
