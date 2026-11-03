import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const cssRoot = root;
export const indexPath = resolve(root, 'src/index.css');

// The four blocks that decide what a pixel is painted with. Everything else in index.css is a
// rule that reads them.
export const themeScopes = [':root', 'html.dark', '.route-map-screen', '.route-map-screen[data-theme="dark"]'];

export const scopeDeclarations = (source: string, selector: string): Record<string, string> => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declarations: Record<string, string> = {};
  for (const block of source.matchAll(new RegExp(`^${escaped} \\{([\\s\\S]*?)\\n\\}`, 'gm'))) {
    const body = block[1].replace(/\/\*[\s\S]*?\*\//g, '');
    for (const token of body.matchAll(/(--(?:mg|color|route|mode)-[a-z0-9-]+):\s*([^;]+);/g))
      declarations[token[1]] = token[2].trim();
  }
  return declarations;
};

// Ascending cascade order the browser applies for each scope. A dark route sheet sits inside
// html.dark, so the dark ramp answers before the sheet's own block does.
const cascadeFor: Record<string, string[]> = {
  ':root': [':root'],
  'html.dark': [':root', 'html.dark'],
  '.route-map-screen': [':root', '.route-map-screen'],
  '.route-map-screen[data-theme="dark"]': themeScopes,
};

const varRef = /var\((--[\w-]+)(?:\s*,\s*([^()]*|[^()]*\([^()]*\)[^()]*))?\)/;

export const resolveValue = (value: string, map: Record<string, string>): string => {
  let current = value;
  for (let step = 0; step < 12; step += 1) {
    const match = varRef.exec(current);
    if (!match) return current;
    const replacement = map[match[1]] ?? match[2]?.trim();
    if (replacement === undefined) return current;
    const next = current.slice(0, match.index) + replacement + current.slice(match.index + match[0].length);
    if (next === current) return current;
    current = next;
  }
  throw new Error(`var() chain too deep: ${value}`);
};

/**
 * Raw and fully var-resolved token declarations for each theme scope, read from live source.
 * Resolved rather than literal because the roles delegate to the blue ramp: "var(--mg-blue-600)"
 * proves nothing about the colour that reaches the screen.
 */
export const readThemeScopes = (source = readFileSync(indexPath, 'utf8')) => {
  const raw = Object.fromEntries(themeScopes.map(scope => [scope, scopeDeclarations(source, scope)]));
  const resolved = Object.fromEntries(themeScopes.map(scope => {
    const map = Object.assign({}, ...cascadeFor[scope].map(name => raw[name]));
    return [scope, Object.fromEntries(
      Object.entries(raw[scope]).map(([token, value]) => [token, resolveValue(value, map)]))];
  }));
  return { raw, resolved };
};
