/** Prompt for a hosted vision model that sees a marked tap on a photo. */
export const NAME_OBJECT_PROMPT =
  'The red circle marks one object. Name the whole object in one or two common English words. If it is a couch, say sofa not armchair. Do not name a part (not cushion, arm, fabric, wall, or floor). Reply with only those words.';

export function parseObjectName(raw: string): string {
  let line = raw.trim().split('\n')[0] ?? '';
  line = line.replace(/^["'`]+|["'`]+$/g, '').trim();
  line = line.replace(
    /^(the object is|the object marked is|it is|this is|that is|that's|the item is)\s+/i,
    '',
  );
  line = line.replace(/^(a|an|the)\s+/i, '');
  line = line.replace(/[.!?]+$/g, '');
  const words = line
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.join(' ');
}
