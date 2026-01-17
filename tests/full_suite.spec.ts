import { test, expect } from '@playwright/test';

async function login(page) {
  // Wait for redirect
  await page.waitForTimeout(2000);
  if (page.url().includes('/auth/')) {
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('#kc-login');
  }
}

test.describe('Full Stack UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost');
    await login(page);
    await expect(page.getByText('Cases').first()).toBeVisible({ timeout: 60000 });
  });

  test('Dashboard Stats', async ({ page }) => {
    await expect(page.getByText('Total Cases')).toBeVisible();
    await expect(page.getByText('Total Media')).toBeVisible();
    await expect(page.getByText('Service Health')).toBeVisible();
  });

  test('Cases Management', async ({ page }) => {
    await page.click('text=Cases');
    await expect(page.getByRole('heading', { name: 'Cases', exact: true })).toBeVisible();
    
    // Create Case
    const caseName = `Auto Case ${Date.now()}`;
    await page.click('text=New Case');
    await page.fill('input[placeholder="Case Name"]', caseName);
    await page.click('button:has-text("Create")');
    await expect(page.getByText(caseName)).toBeVisible();
    
    // Enter Case
    await page.click(`text=${caseName}`);
    await expect(page.getByText(caseName)).toBeVisible(); // Header
    await expect(page.getByText('Upload Media')).toBeVisible();
  });

  test('Map View', async ({ page }) => {
    await page.click('nav >> text=Map');
    await expect(page.getByRole('heading', { name: 'Map View' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Full Map' })).toBeVisible();
    const href = await page.getAttribute('text=Full Map', 'href');
    expect(href).toBe('/osm/');
  });

  test('Timeline', async ({ page }) => {
    await page.click('text=Timeline');
    await expect(page.getByRole('heading', { name: 'Global Timeline' })).toBeVisible();
  });

  test('Watchlists', async ({ page }) => {
    await page.click('text=Watchlists');
    await expect(page.locator('h1:has-text("Watchlists")')).toBeVisible();
    
    const wlName = `WL ${Date.now()}`;
    await expect(page.getByText('New Watchlist')).toBeVisible();
    await page.click('text=New Watchlist');
    await page.fill('input[placeholder="Watchlist name"]', wlName);
    await page.click('.fixed button:has-text("Create")');
    await expect(page.getByText(wlName)).toBeVisible();
  });

  test('Search', async ({ page }) => {
    await page.click('nav >> text=Search');
    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
    
    // Search for "Real Data Case" (seeded)
    await page.waitForSelector('input[placeholder="Search cases, persons, media..."]', { state: 'visible' });
    const input = page.locator('input[placeholder="Search cases, persons, media..."]');
    await expect(input).toBeVisible();
    await input.fill('Real Data');
    await page.click('button:has-text("Search")');
    await expect(page.locator('h2:has-text("Results")').or(page.getByText('No matches found'))).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Real Data Case')).toBeVisible();
  });
  
  test('Notes', async ({ page }) => {
    const navItems = await page.locator('nav a').allInnerTexts();
    if (navItems.some(t => t.includes('Notes'))) {
        await page.click('nav >> text=Notes');
        await expect(page.locator('h1:has-text("Case Notes")')).toBeVisible();
    }
  });
  
  test('Tasks', async ({ page }) => {
    const navItems = await page.locator('nav a').allInnerTexts();
    if (navItems.some(t => t.includes('Tasks'))) {
        await page.click('nav >> text=Tasks');
        await expect(page.locator('h1:has-text("Tasks")')).toBeVisible();
    }
  });
});
