export function nextRemovedId<T extends { id: string }>(
  objects: T[],
  max: number,
): string | null {
  if (objects.length < max) return null;
  return objects[0]?.id ?? null;
}

export function applyObjectLimit<T extends { id: string }>(
  objects: T[],
  incoming: T,
  max: number,
): { objects: T[]; removed: T | null } {
  const next = objects.filter((object) => object.id !== incoming.id);
  let removed: T | null = null;
  if (next.length >= max) {
    removed = next.shift() ?? null;
  }
  next.push(incoming);
  return { objects: next, removed };
}
