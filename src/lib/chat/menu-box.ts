const MENU_MARGIN = 8;
const MENU_GAP = 4;

export function placeMenuBox(
  anchor: { top: number; bottom: number; left: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  bounds?: { top?: number; bottom?: number },
): { top: number; left: number; maxHeight: number } {
  let left = anchor.left;
  if (left + size.width > viewport.width - MENU_MARGIN) {
    left = viewport.width - MENU_MARGIN - size.width;
  }
  left = Math.max(MENU_MARGIN, left);
  const floor = bounds?.bottom ?? viewport.height;
  const ceiling = bounds?.top ?? MENU_MARGIN;
  const limitBottom = Math.min(viewport.height - MENU_MARGIN, floor - MENU_GAP);
  const limitTop = Math.max(MENU_MARGIN, ceiling);
  const spaceBelow = limitBottom - anchor.bottom;
  const spaceAbove = anchor.top - limitTop;
  let top = anchor.bottom + MENU_GAP;
  const height = size.height;
  if (height > spaceBelow && spaceAbove > spaceBelow) {
    top = anchor.top - MENU_GAP - height;
  }
  if (top < limitTop) top = limitTop;
  if (top + height > limitBottom) top = Math.max(limitTop, limitBottom - height);
  const maxHeight = Math.max(0, Math.min(height, limitBottom - top));
  return { top, left, maxHeight };
}
