import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const isDev = process.argv.includes('--watch');

async function build() {
  const commonConfig = {
    bundle: true,
    platform: 'node',
    target: 'node20',
    sourcemap: isDev ? 'inline' : false,
    external: ['electron', 'sql.js'],
  };

  if (!fs.existsSync('dist-electron')) {
    fs.mkdirSync('dist-electron', { recursive: true });
  }

  // Copy sql.js wasm binary if it exists
  const wasmSrc = path.resolve('node_modules/sql.js/dist/sql-wasm.wasm');
  const wasmDest = path.resolve('dist-electron/sql-wasm.wasm');
  if (fs.existsSync(wasmSrc)) {
    fs.copyFileSync(wasmSrc, wasmDest);
  }

  // Main process
  const mainCtx = await esbuild.context({
    ...commonConfig,
    entryPoints: ['src/main/index.ts'],
    outfile: 'dist-electron/main.cjs',
    format: 'cjs',
  });

  // Preload script
  const preloadCtx = await esbuild.context({
    ...commonConfig,
    entryPoints: ['src/preload/index.ts'],
    outfile: 'dist-electron/preload.cjs',
    format: 'cjs',
  });

  if (isDev) {
    await mainCtx.watch();
    await preloadCtx.watch();
    console.log('[esbuild] Watching main & preload for changes...');
  } else {
    await mainCtx.rebuild();
    await preloadCtx.rebuild();
    await mainCtx.dispose();
    await preloadCtx.dispose();
    console.log('[esbuild] Main & preload built successfully.');
  }
}

build().catch((err) => {
  console.error('[esbuild] Build error:', err);
  process.exit(1);
});
