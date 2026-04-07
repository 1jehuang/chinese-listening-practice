const esbuild = require('esbuild');

async function main() {
  await esbuild.build({
    entryPoints: [
      'src/sentence-mode-ui.jsx',
      'src/mode-sidebar-ui.jsx',
      'src/confidence-panel-ui.jsx',
      'src/command-palette-ui.jsx',
      'src/eeg-decision-ui.jsx',
      'src/sentence-drill.jsx',
      'src/context-listening.jsx'
    ],
    bundle: true,
    format: 'iife',
    outdir: 'js',
    outbase: 'src',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    entryNames: '[dir]/[name]',
    target: ['es2018'],
    sourcemap: false,
    logLevel: 'info'
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
