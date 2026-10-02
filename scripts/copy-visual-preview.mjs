import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist/preview', { recursive: true });
await copyFile('preview/index.html', 'dist/preview/index.html');
console.log('Visual preview copied to dist/preview/index.html');
