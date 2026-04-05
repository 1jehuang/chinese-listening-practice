const esbuild = require('esbuild');

async function main() {
  await esbuild.build({
    entryPoints: ['src/sentence-mode-ui.jsx', 'src/mode-sidebar-ui.jsx'],
    bundle: true,
    format: 'iife',
    outdir: 'js',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    entryNames: '[name]',
    target: ['es2018'],
    sourcemap: false,
    logLevel: 'info'
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
