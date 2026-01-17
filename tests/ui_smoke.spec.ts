import { test, expect } from '@playwright/test';

test('Smoke Test: UI Interlink Functionality', async ({ page }) => {
  console.log('Navigating to home...');
  await page.goto('http://localhost');
  
  // Wait for redirect
  await page.waitForTimeout(2000);
  console.log(`Current URL: ${page.url()}`);
  console.log(`Current Title: ${await page.title()}`);

  // Login if on Keycloak
  if (page.url().includes('/auth/')) {
    console.log('Detected Keycloak login page.');
    await page.waitForSelector('#username', { state: 'visible', timeout: 10000 });
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('#kc-login');
    console.log('Login submitted.');
  } else {
    console.log('Not on login page?');
  }
  
  // Wait for Dashboard
  console.log('Waiting for Dashboard "Cases" text...');
  // Increase timeout as first load might be slow
  await expect(page.getByText('Cases').first()).toBeVisible({ timeout: 60000 });
  
  // 2. Navigate to Case
  console.log('Navigating to Cases...');
  await page.getByText('Cases').first().click();
  
  console.log('Opening UI Test Case...');
  await expect(page.getByText('UI Test Case')).toBeVisible();
  await page.getByText('UI Test Case').click();
  
  // 3. Verify Video Signature Badge
  console.log('Checking for VSM badge...');
  // The media card should be visible
  await expect(page.getByText('test_video.mp4')).toBeVisible();
  await expect(page.getByText('VSM')).toBeVisible();
  
  // 4. Open Media Modal and Verify
  console.log('Opening video details...');
  await page.getByText('test_video.mp4').click();
  
  console.log('Verifying Video Signature details...');
  await expect(page.getByText('Video Signature (VSM)')).toBeVisible();
  await expect(page.getByText('Temporal: deadbeef12345678')).toBeVisible();
  
  // Close modal
  await page.keyboard.press('Escape');

  // 5. Verify Map View Link
  console.log('Navigating to Map View...');
  await page.getByRole('link', { name: 'Map View' }).click();
  
  console.log('Checking Full Map button...');
  await expect(page.getByRole('link', { name: 'Full Map' })).toBeVisible();
  
  console.log('UI Smoke Test Passed!');
});
