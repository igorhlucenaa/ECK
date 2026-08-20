import { existsSync } from 'fs';
import { platform } from 'os';

const DEFAULT_VIEWPORT = {
  width: 1240,
  height: 1754,
  deviceScaleFactor: 1,
};

const LOCAL_CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

function resolveLocalChromeExecutablePath(): string | null {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH
    || process.env.CHROME_PATH
    || process.env.GOOGLE_CHROME_BIN;

  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }

  const candidates: string[] = [];

  if (platform() === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.PROGRAMFILES || ''}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env['PROGRAMFILES(X86)'] || ''}\\Google\\Chrome\\Application\\chrome.exe`,
    );
  } else if (platform() === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    );
  }

  return candidates.find((path) => path && existsSync(path)) ?? null;
}

function shouldPreferLocalChrome(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true'
    || process.env.USE_LOCAL_CHROME === 'true'
    || platform() === 'win32'
    || platform() === 'darwin';
}

export async function launchPuppeteerBrowser(): Promise<{
  close: () => Promise<void>;
  newPage: () => Promise<any>;
}> {
  const { default: puppeteer } = await import('puppeteer-core');

  if (shouldPreferLocalChrome()) {
    const executablePath = resolveLocalChromeExecutablePath();
    if (executablePath) {
      console.log('[puppeteer] Usando Chrome local', { executablePath });
      return puppeteer.launch({
        executablePath,
        headless: true,
        args: LOCAL_CHROME_ARGS,
        defaultViewport: DEFAULT_VIEWPORT,
      });
    }

    console.warn('[puppeteer] Chrome local nao encontrado; tentando @sparticuz/chromium');
  }

  const { default: chromium } = await import('@sparticuz/chromium');
  console.log('[puppeteer] Usando @sparticuz/chromium');
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: DEFAULT_VIEWPORT,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}
