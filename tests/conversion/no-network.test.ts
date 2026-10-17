import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src');
const ALLOW = `${join('src', 'conversion', 'live')}`;

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (path.endsWith('.ts')) files.push(path);
  }
  return files;
}

describe('network isolation', () => {
  it('keeps fetch, XHR and WebSockets inside live conversion', () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      if (file.includes(`${join('conversion', 'live')}`)) continue;
      const text = readFileSync(file, 'utf8');
      if (/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
    expect(ALLOW).toContain('live');
  });
});
