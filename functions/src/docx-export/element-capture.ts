import sizeOf from 'image-size';

let browserLauncherPromise: Promise<{
  launch: (html: string) => Promise<{
    capture: (selector: string) => Promise<Buffer | null>;
    close: () => Promise<void>;
  }>;
}> | null = null;

async function getBrowserLauncher() {
  if (!browserLauncherPromise) {
    browserLauncherPromise = (async () => {
      const { launchPuppeteerBrowser } = await import('../shared/puppeteer-browser.js');

      return {
        launch: async (html: string) => {
          const browser = await launchPuppeteerBrowser();

          const page = await browser.newPage();
          page.setDefaultNavigationTimeout(60000);
          page.setDefaultTimeout(120000);

          await page.setRequestInterception(true);
          page.on('request', (request: { url: () => string; continue: () => void; abort: () => void }) => {
            const url = request.url();
            if (url === 'about:blank' || url.startsWith('data:') || url.startsWith('blob:')) {
              request.continue();
              return;
            }
            request.abort();
          });

          await page.setContent(html, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });
          await page.emulateMediaType('print');
          await new Promise((resolve) => setTimeout(resolve, 250));

          return {
            capture: async (selector: string) => {
              const handle = await page.$(selector);
              if (!handle) return null;
              return Buffer.from(await handle.screenshot({
                type: 'png',
                omitBackground: false,
              }));
            },
            close: async () => {
              await browser.close();
            },
          };
        },
      };
    })();
  }

  return browserLauncherPromise;
}

export interface CapturedElementImage {
  data: Buffer;
  widthPx: number;
  heightPx: number;
}

export async function captureElementsFromHtml(
  html: string,
  selectors: string[]
): Promise<Map<string, CapturedElementImage>> {
  const uniqueSelectors = [...new Set(selectors.filter(Boolean))];
  if (uniqueSelectors.length === 0) {
    return new Map();
  }

  const launcher = await getBrowserLauncher();
  const session = await launcher.launch(html);
  const results = new Map<string, CapturedElementImage>();

  try {
    for (const selector of uniqueSelectors) {
      const pngBuffer = await session.capture(selector);
      if (!pngBuffer || pngBuffer.length === 0) continue;

      const dimensions = sizeOf(pngBuffer);
      results.set(selector, {
        data: pngBuffer,
        widthPx: dimensions.width ?? 1,
        heightPx: dimensions.height ?? 1,
      });
    }
  } finally {
    await session.close();
  }

  return results;
}
