const MARGIN = 8;

export function anchorTo(panel, trigger) {
  const target = trigger.getBoundingClientRect();
  const box = panel.getBoundingClientRect();

  const fitsRight = target.right + box.width + MARGIN <= window.innerWidth;
  const fitsBelow = target.bottom + box.height + MARGIN <= window.innerHeight;

  const left = fitsRight
    ? Math.min(target.left, window.innerWidth - box.width - MARGIN)
    : Math.max(MARGIN, target.right - box.width);

  const top = fitsBelow
    ? target.bottom + MARGIN
    : Math.max(MARGIN, target.top - box.height - MARGIN);

  panel.style.left = `${Math.max(MARGIN, left)}px`;
  panel.style.top = `${top}px`;
}
