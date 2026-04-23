const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { chromium } = require('playwright');

const PORT = 8124;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PAGE = 'common-words.html';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/home.html`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`Timed out waiting for local server on ${BASE_URL}`);
}

async function launchServer() {
  const logFile = path.join(process.cwd(), 'server.log');
  const out = fs.openSync(logFile, 'a');
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], {
    cwd: process.cwd(),
    stdio: ['ignore', out, out]
  });

  server.on('error', (error) => {
    console.error('Failed to start local server:', error);
  });

  await waitForServerReady();
  return server;
}

async function main() {
  const server = await launchServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${BASE_URL}/${PAGE}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    await page.evaluate(() => {
      const btn = document.querySelector('.mode-btn[data-mode="char-to-tones"]');
      if (!btn) throw new Error('Char-to-tones mode button not found');
      btn.click();
    });
    await page.waitForTimeout(900);

    const audit = await page.evaluate(() => {
      const rect = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        bodyClassName: document.body.className,
        bodyQuizMode: document.body.dataset.quizMode || '',
        quizDisplay: rect('.quiz-display'),
        questionRow: rect('.question-row'),
        inputSection: rect('.input-section'),
        toneLayout: rect('.tone-mc-layout'),
        options: rect('#options'),
        toneButtons: Array.from(document.querySelectorAll('#options .tone-btn')).map((btn) => {
          const r = btn.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
        })
      };
    });

    assert.strictEqual(audit.bodyQuizMode, 'char-to-tones', 'body quiz mode should track char-to-tones');
    assert.ok(audit.bodyClassName.includes('char-to-tones-active'), 'body should have char-to-tones-active class');
    assert.ok(audit.questionRow, 'question row should render');
    assert.ok(audit.inputSection, 'input section should render');
    assert.ok(audit.toneLayout, 'tone layout should render');
    assert.ok(audit.options, 'tone options should render');
    assert.strictEqual(audit.toneButtons.length, 5, 'char-to-tones should show five tone buttons');
    assert.ok(
      audit.questionRow.bottom <= audit.inputSection.y + 1,
      `question row should sit above the input section on mobile (row bottom=${audit.questionRow.bottom}, input top=${audit.inputSection.y})`
    );

    for (const [index, button] of audit.toneButtons.entries()) {
      assert.ok(button.right <= audit.viewport.width + 1, `tone button ${index + 1} should stay within viewport`);
    }

    console.log('✓ Char-to-tones mobile layout stays stacked without overlap');
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server && !server.killed) server.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
