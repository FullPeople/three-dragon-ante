export { chromium } from '@playwright/test';
export function browserLaunchOptions() {
  const executablePath = process.env.TDA_BROWSER || process.env.CHROME_PATH;
  if (executablePath) return { executablePath };
  const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : '');
  return channel ? { channel } : {};
}
