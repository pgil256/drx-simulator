// Captures repeatable browser screenshots for visual comparison.
//
// Start the app first, then run:
//   APP_URL=http://localhost:5173 node scripts/capture-browser-views.mjs
//
// Optional:
//   BROWSER_EXECUTABLE_PATH=/path/to/chrome OUT_DIR=test-artifacts/model-views node scripts/capture-browser-views.mjs

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const OUT_DIR = path.resolve(process.env.OUT_DIR ?? 'test-artifacts/model-views');
const VIEWPORT = { width: 900, height: 900, deviceScaleFactor: 1 };

const VIEWS = [
  { name: 'three-quarter-front', aria: '3/4 View' },
  { name: 'side', aria: 'Side' },
  { name: 'overhead', aria: 'Overhead' },
];

function browserCandidates() {
  if (process.env.BROWSER_EXECUTABLE_PATH) return [process.env.BROWSER_EXECUTABLE_PATH];
  if (process.platform === 'win32') {
    return [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ];
}

const executablePath = browserCandidates().find((candidate) => fs.existsSync(candidate));
if (!executablePath) {
  throw new Error(
    'No Chrome/Edge executable found. Set BROWSER_EXECUTABLE_PATH to capture model views.',
  );
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  defaultViewport: VIEWPORT,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      console.log(`[browser:${message.type()}] ${message.text()}`);
    }
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    return canvas && canvas.width > 0 && canvas.height > 0;
  });

  for (const view of VIEWS) {
    await page.click(`button[aria-label="${view.aria}"]`);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const outPath = path.join(OUT_DIR, `${view.name}.png`);
    await page.screenshot({ path: outPath });
    console.log(`${view.name}: ${outPath}`);
  }
} finally {
  await browser.close();
}
