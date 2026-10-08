/**
 * docs/API.md is the contract the UI and E2E engineers code against: every
 * documented endpoint must exist with that method, and every exported route
 * handler must be documented.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, 'src/app/api');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function documentedEndpoints(): Set<string> {
  const doc = readFileSync(path.join(ROOT, 'docs/API.md'), 'utf8');
  const found = new Set<string>();
  for (const match of doc.matchAll(/`(GET|POST|PUT|PATCH|DELETE) (\/api\/[^`?\s]+)`/g)) {
    found.add(`${match[1]} ${match[2]}`);
  }
  return found;
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('_')) return []; // private folders (tests) are never routed
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === 'route.ts' ? [full] : [];
  });
}

/** `/home/…/src/app/api/posts/[id]/vote/route.ts` → `/api/posts/:id/vote` */
function urlPath(file: string): string {
  const rel = path.relative(path.join(ROOT, 'src/app'), path.dirname(file));
  return `/${rel.split(path.sep).join('/')}`.replace(/\[(\w+)\]/g, ':$1');
}

describe('docs/API.md ↔ route handlers', () => {
  it('documents the 16 endpoints the backend provides (7 public, 9 admin)', () => {
    expect(documentedEndpoints().size).toBe(16);
  });

  it('every documented endpoint has a handler, and every handler is documented', async () => {
    const documented = documentedEndpoints();
    const implemented = new Set<string>();
    for (const file of routeFiles(API_DIR)) {
      const mod = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
      expect(mod.runtime, file).toBe('nodejs');
      expect(mod.dynamic, file).toBe('force-dynamic');
      for (const method of METHODS) {
        if (typeof mod[method] === 'function') implemented.add(`${method} ${urlPath(file)}`);
      }
    }
    expect([...implemented].sort()).toEqual([...documented].sort());
  });
});
