const MENU_MARGIN = 8;
const MENU_GAP = 4;

export function placeMenuBox(
  anchor: { top: number; bottom: number; left: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  let left = anchor.left;
  if (left + size.width > viewport.width - MENU_MARGIN) {
    left = viewport.width - MENU_MARGIN - size.width;
  }
  left = Math.max(MENU_MARGIN, left);
  const spaceBelow = viewport.height - anchor.bottom - MENU_MARGIN;
  const spaceAbove = anchor.top - MENU_MARGIN;
  let top = anchor.bottom + MENU_GAP;
  if (size.height > spaceBelow && spaceAbove > spaceBelow) {
    top = anchor.top - MENU_GAP - size.height;
  }
  if (top < MENU_MARGIN) top = MENU_MARGIN;
  const maxTop = viewport.height - MENU_MARGIN - size.height;
  if (top > maxTop) top = Math.max(MENU_MARGIN, maxTop);
  return { top, left };
}
