const esbuild = require('esbuild');

async function main() {
  await esbuild.build({
    entryPoints: ['src/sentence-mode-ui.jsx'],
    bundle: true,
    format: 'iife',
    outfile: 'js/sentence-mode-ui.js',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    target: ['es2018'],
    sourcemap: false,
    logLevel: 'info'
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
