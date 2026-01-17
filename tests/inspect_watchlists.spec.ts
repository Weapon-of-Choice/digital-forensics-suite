import { test, expect } from '@playwright/test';

test('Inspect Watchlists', async ({ page }) => {
  console.log('Navigating...');
  await page.goto('http://localhost/watchlists');
  
  // Login if needed
  if (page.url().includes('/auth/')) {
    console.log('Logging in...');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('#kc-login');
    await page.waitForURL('http://localhost/watchlists', { timeout: 10000 });
  }
  
  console.log('Waiting for page content...');
  await page.waitForTimeout(5000); // Give it time to render/crash
  
  const title = await page.title();
  const bodyText = await page.locator('body').innerText();
  
  console.log('--- PAGE DUMP ---');
  console.log(`Title: ${title}`);
  console.log(`Visible Text: \n${bodyText}`);
  console.log('-----------------');
  
  const h1s = await page.locator('h1').allInnerTexts();
  console.log(`Headings (H1): ${JSON.stringify(h1s)}`);
  
  const buttons = await page.locator('button').allInnerTexts();
  console.log(`Buttons: ${JSON.stringify(buttons)}`);

  // Check console logs
  page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.text()}`));
  page.on('pageerror', err => console.log(`BROWSER ERROR: ${err}`));
});
