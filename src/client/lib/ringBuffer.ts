/**
 * Returns a new array with item appended, capped at maxSize.
 * Immutable — never mutates the input array.
 */
export function addToRingBuffer<T>(
  buffer: T[],
  item: T,
  maxSize: number = 300
): T[] {
  const next = [...buffer, item];
  if (next.length > maxSize) {
    return next.slice(next.length - maxSize);
  }
  return next;
}
