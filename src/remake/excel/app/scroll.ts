// 滚动定位：只滚动自己的容器（不用 scrollIntoView，避免带动 iframe 文档整体平移），并扣掉 sticky 冻结区

/**
 * 让 [start, start + size) 落进可视区 [scroll + sticky, scroll + viewport) 所需的新滚动位置。
 * 比可视区还大的目标：起点贴住 sticky 区边缘。
 */
export function scrollToReveal(start: number, size: number, scroll: number, viewport: number, sticky: number): number {
  const visibleStart = scroll + sticky;
  const visibleEnd = scroll + viewport;
  if (start < visibleStart) return Math.max(0, start - sticky);
  if (start + size > visibleEnd) return Math.max(0, Math.min(start + size - viewport, start - sticky));
  return scroll;
}
