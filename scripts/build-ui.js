const esbuild = require('esbuild');

async function main() {
  await esbuild.build({
    entryPoints: [
      'src/sentence-mode-ui.jsx',
      'src/tutorial-mode-ui.jsx',
      'src/mode-sidebar-ui.jsx',
      'src/confidence-panel-ui.jsx',
      'src/command-palette-ui.jsx',
      'src/eeg-decision-ui.jsx',
      'src/eeg-overlay-ui.jsx',
      'src/sentence-drill.jsx',
      'src/context-listening.jsx',
      'src/quiz-choice-ui.jsx',
      'src/quiz-fuzzy-ui.jsx',
      'src/quiz-question-ui.jsx',
      'src/quiz-feedback-ui.jsx',
      'src/quiz-scheduler-ui.jsx',
      'src/quiz-study-ui.jsx',
      'src/chat-ui.jsx',
      'src/auth-ui.jsx'
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
