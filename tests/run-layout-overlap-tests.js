const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 8123;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SCREENSHOT_DIR = path.join(process.cwd(), '.playwright-mcp');
const PAGES = [
  'lesson-14-part-1.html',
  'lesson-13-16-cumulative.html',
  'lesson-1-quiz.html',
  'lesson-1-temp-sentence.html',
  'common-words.html',
  'common-characters.html',
  'lesson-10-cumulative.html',
  'lesson-14-dictation.html',
  'lesson-18-part-2.html',
  'lesson-19-part-2.html',
  'lesson-21-cumulative.html',
  'lesson-1-4-common-words.html'
];
const WIDTHS = [1440, 1180, 980, 820, 700, 600];
const MODES_TO_TRY = ['sentence', 'draw-char'];

function overlap(a, b) {
  return a && b && a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 &&
    a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function maybeSwitchMode(page) {
  for (const mode of MODES_TO_TRY) {
    const button = page.locator(`button[data-mode="${mode}"]`).first();
    if (await button.count()) {
      try {
        await button.click({ timeout: 1000 });
        await page.waitForTimeout(700);
      } catch {}
      return mode;
    }
  }
  return null;
}

async function ensureConfidencePanelOpen(page, width) {
  const canShowConfidence = width > 1024;
  if (!canShowConfidence) {
    await page.evaluate(() => {
      if (typeof setConfidencePanelVisible === 'function') {
        setConfidencePanelVisible(false);
      }
    }).catch(() => {});
    await page.waitForTimeout(150);
    return false;
  }

  try {
    await page.evaluate(() => {
      if (typeof setConfidencePanelVisible === 'function') {
        setConfidencePanelVisible(true);
      }
    });
    await page.waitForTimeout(250);
    return true;
  } catch {
    return false;
  }
}

async function auditPage(browser, pagePath, width) {
  const page = await browser.newPage({ viewport: { width, height: 1100 } });
  try {
    await page.goto(`${BASE_URL}/${pagePath}`, { waitUntil: 'networkidle' });
  } catch {
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(1000);

  const mode = await maybeSwitchMode(page);
  const confidenceOpened = await ensureConfidencePanelOpen(page, width);
  await page.waitForTimeout(250);

  const audit = await page.evaluate(() => {
    const visibleRects = (selector) => Array.from(document.querySelectorAll(selector)).map((el) => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return null;
      const r = el.getBoundingClientRect();
      if (!r || r.width <= 0 || r.height <= 0) return null;
      return {
        selector,
        text: (el.textContent || '').trim().slice(0, 80),
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom
      };
    }).filter(Boolean);

    const firstRect = (selector) => visibleRects(selector)[0] || null;

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      doc: {
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      },
      fixed: {
        sidebar: firstRect('.sidebar-wrapper.left, .app-container > .sidebar, .app-container > aside.sidebar'),
        confidence: firstRect('#confidencePanel'),
        home: firstRect('.home-btn'),
        mobileToggle: firstRect('#sidebarMobileToggle'),
      },
      targets: [
        ...visibleRects('.quiz-header'),
        ...visibleRects('#questionDisplay > *'),
        ...visibleRects('.input-section'),
        ...visibleRects('#feedback'),
        ...visibleRects('#hint'),
        ...visibleRects('.sentence-mode-shell'),
        ...visibleRects('.three-column-meaning-layout'),
        ...visibleRects('.three-column-pinyin-layout'),
        ...visibleRects('.three-column-translation-layout'),
        ...visibleRects('.three-column-pinyin-dictation-layout'),
        ...visibleRects('.three-column-chunks-layout'),
      ]
    };
  });

  const issues = [];
  const { sidebar, confidence, home, mobileToggle } = audit.fixed;
  for (const target of audit.targets) {
    if (sidebar && overlap(sidebar, target)) issues.push(`sidebar overlaps ${target.selector}`);
    if (confidence && overlap(confidence, target)) issues.push(`confidence overlaps ${target.selector}`);
    if (home && overlap(home, target)) issues.push(`home overlaps ${target.selector}`);
    if (mobileToggle && overlap(mobileToggle, target)) issues.push(`mobile toggle overlaps ${target.selector}`);
    if (target.right > audit.viewport.width + 1) issues.push(`${target.selector} exceeds viewport`);
  }

  if (audit.doc.scrollWidth > audit.viewport.width + 2 || audit.doc.bodyScrollWidth > audit.viewport.width + 2) {
    issues.push(`horizontal overflow doc=${audit.doc.scrollWidth}/${audit.doc.bodyScrollWidth} viewport=${audit.viewport.width}`);
  }

  const uniqueIssues = [...new Set(issues)];
  if (uniqueIssues.length) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const safeName = `${pagePath.replace(/[^a-z0-9]+/gi, '_')}-${width}`;
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `layout-overlap-${safeName}.png`), fullPage: true });
  }

  await page.close();
  return { pagePath, width, mode, confidenceOpened, issues: uniqueIssues };
}

async function main() {
  const server = await launchServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const failures = [];
    for (const pagePath of PAGES) {
      for (const width of WIDTHS) {
        const result = await auditPage(browser, pagePath, width);
        if (result.issues.length) failures.push(result);
      }
    }

    if (failures.length) {
      console.error('Layout overlap audit failed:');
      for (const failure of failures) {
        console.error(`- ${failure.pagePath} @ ${failure.width}px${failure.mode ? ` mode=${failure.mode}` : ''}`);
        for (const issue of failure.issues) {
          console.error(`    • ${issue}`);
        }
      }
      process.exitCode = 1;
      return;
    }

    console.log(`Layout overlap audit passed for ${PAGES.length} pages across ${WIDTHS.length} widths.`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server && !server.killed) {
      server.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
