// Captures min/rest/max browser views for the three DRX actuators.
//
// Start the app first, then run:
//   APP_URL=http://localhost:5173 node scripts/capture-motion-views.mjs

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const OUT_DIR = path.resolve(process.env.OUT_DIR ?? 'test-artifacts/model-motion');
const VIEWPORT = { width: 900, height: 900, deviceScaleFactor: 1 };

const SEQUENCES = [
  {
    actuator: 'axial',
    camera: 'Side',
    states: [
      { label: '000', axial: 0, horizontal: -15, lateral: 0 },
      { label: '002', axial: 2, horizontal: -15, lateral: 0 },
      { label: '004', axial: 4, horizontal: -15, lateral: 0 },
    ],
  },
  {
    actuator: 'horizontal',
    camera: 'Side',
    states: [
      { label: 'neg25', axial: 0, horizontal: -25, lateral: 0 },
      { label: 'neg15-rest', axial: 0, horizontal: -15, lateral: 0 },
      { label: 'pos05', axial: 0, horizontal: 5, lateral: 0 },
    ],
  },
  {
    actuator: 'lateral',
    camera: 'Overhead',
    states: [
      { label: 'neg20', axial: 0, horizontal: -15, lateral: -20 },
      { label: '000-rest', axial: 0, horizontal: -15, lateral: 0 },
      { label: 'pos20', axial: 0, horizontal: -15, lateral: 20 },
    ],
  },
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
    'No Chrome/Edge executable found. Set BROWSER_EXECUTABLE_PATH to capture motion views.',
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
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => window.store?.getState);

  for (const sequence of SEQUENCES) {
    await page.click(`button[aria-label="${sequence.camera}"]`);
    for (const state of sequence.states) {
      await page.evaluate((next) => {
        const store = window.store;
        const current = store.getState().device;
        store.setState({
          device: {
            ...current,
            axial: { ...current.axial, pos: next.axial, target: next.axial, moving: false },
            horizontal: {
              ...current.horizontal,
              pos: next.horizontal,
              target: next.horizontal,
              moving: false,
            },
            lateral: { ...current.lateral, pos: next.lateral, target: next.lateral, moving: false },
          },
        });
      }, state);
      await new Promise((resolve) => setTimeout(resolve, 700));
      const outPath = path.join(OUT_DIR, `${sequence.actuator}-${state.label}.png`);
      await page.screenshot({ path: outPath });
      console.log(`${sequence.actuator} ${state.label}: ${outPath}`);
    }
  }

  await page.click('button[aria-label="Side"]');
  await page.evaluate(() => {
    const store = window.store;
    const current = store.getState().device;
    store.setState({
      device: {
        ...current,
        axial: { ...current.axial, pos: 2, target: 2, moving: false },
        horizontal: { ...current.horizontal, pos: -15, target: -15, moving: false },
        lateral: { ...current.lateral, pos: 0, target: 0, moving: false },
        pulsing: true,
      },
    });
  });
  await new Promise((resolve) => setTimeout(resolve, 220));
  const pulseA = path.join(OUT_DIR, 'pulse-axial-a.png');
  await page.screenshot({ path: pulseA });
  console.log(`pulse axial a: ${pulseA}`);
  await new Promise((resolve) => setTimeout(resolve, 360));
  const pulseB = path.join(OUT_DIR, 'pulse-axial-b.png');
  await page.screenshot({ path: pulseB });
  console.log(`pulse axial b: ${pulseB}`);
  await page.evaluate(() => {
    const store = window.store;
    const current = store.getState().device;
    store.setState({ device: { ...current, pulsing: false } });
  });
} finally {
  await browser.close();
}
