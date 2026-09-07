// Empacota os dois handlers em bundles unicos para a Lambda (Node 22, ESM).
// O SDK da AWS fica externo: ja existe no runtime, incluir so aumentaria o zip.
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

await build({
  entryPoints: { handler: 'src/handler.ts', authorizer: 'src/authorizer.ts' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  sourcemap: true,
  minify: true,
  external: ['@aws-sdk/*'],
  banner: {
    js: "import{createRequire}from'node:module';const require=createRequire(import.meta.url);",
  },
});

console.log('Bundles gerados em dist/ (handler.mjs, authorizer.mjs)');
