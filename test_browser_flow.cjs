const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runQA() {
  const screenshotsDir = 'C:\\Users\\denis\\Documents\\antigravity\\taksi\\taksi\\demo_screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  const consoleLogs = [];
  const errors = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', err => {
    errors.push(err.toString());
  });

  console.log('--- Step 1: Navigating to frontend ---');
  await page.goto('http://localhost:5173/taksi/', { waitUntil: 'networkidle' });
  console.log('Page title:', await page.title());

  // Screenshot Auth Screen
  await page.screenshot({ path: path.join(screenshotsDir, '00_auth_screen.png') });
  console.log('Saved 00_auth_screen.png');

  // Step 2: Log in as alex_smirnov
  console.log('--- Step 2: Logging in as alex_smirnov ---');
  // Find username and password inputs
  await page.locator('input[placeholder*=ivan_ivanov], input[type=text]').first().fill('alex_smirnov');
  await page.locator('input[type=password]').first().fill('StudentPass123!');
  
  // Click submit button
  await page.locator('button[type=submit]').first().click();

  // Wait for feed to load
  await page.waitForSelector('text=Поиск поездок, text=Найти поездку, text=Кампус Новокольцовский', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Step 3: Inspect Feed
  console.log('--- Step 3: Inspecting Find Rides Feed ---');
  const feedCards = await page.locator('text=Кампус Новокольцовский').count();
  console.log('Found UrFU route occurrences:', feedCards);

  // Screenshot Feed
  await page.screenshot({ path: path.join(screenshotsDir, '01_rides_feed.png') });
  console.log('Saved 01_rides_feed.png');

  // Step 4: Open Ride Details & Verify Map / Polyline
  console.log('--- Step 4: Expanding Ride Details ---');
  const expandButtons = page.locator('button[aria-label*=детали поездки]');
  const expandCount = await expandButtons.count();
  console.log('Found expand buttons:', expandCount);
  if (expandCount > 0) {
    await expandButtons.first().click();
  } else {
    // Click first card
    await page.locator('.MuiCard-root').first().click();
  }

  // Wait for map container to appear
  await page.waitForSelector('text=Маршрут на карте', { timeout: 10000 });
  console.log('Маршрут на карте header rendered.');

  // Give Yandex Maps script and polyline rendering time to draw
  await page.waitForTimeout(4000);

  // Screenshot Ride Details with Map
  await page.screenshot({ path: path.join(screenshotsDir, '02_ride_details_map.png') });
  console.log('Saved 02_ride_details_map.png');

  // Step 5: Check Reviews dialog if available on card
  const reviewsBtn = page.locator('button:has-text(отзыв), button:has-text(★)').first();
  if (await reviewsBtn.isVisible()) {
    console.log('Clicking reviews button on card...');
    await reviewsBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, '04_reviews_modal.png') });
    console.log('Saved 04_reviews_modal.png');
    // Close modal if open
    const closeBtn = page.locator('button[aria-label=close], button:has-text(Закрыть)').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // Step 6: Navigate to Profile / Reviews screen
  console.log('--- Step 6: Navigating to Profile screen ---');
  await page.goto('http://localhost:5173/taksi/profile', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Screenshot Profile / Reviews
  await page.screenshot({ path: path.join(screenshotsDir, '03_profile_reviews.png') });
  console.log('Saved 03_profile_reviews.png');

  // Step 7: Mobile Viewport test for feed
  console.log('--- Step 7: Mobile Viewport check ---');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173/taksi/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '05_mobile_feed.png') });
  console.log('Saved 05_mobile_feed.png');

  console.log('--- Diagnostic Summary ---');
  console.log('Errors count:', errors.length);
  if (errors.length > 0) {
    console.log('Page Errors:', errors);
  }
  const severeLogs = consoleLogs.filter(l => l.type === 'error');
  console.log('Console Errors count:', severeLogs.length);
  if (severeLogs.length > 0) {
    console.log('Console Errors:', severeLogs.slice(0, 5));
  }

  await browser.close();
  console.log('QA script finished successfully.');
}

runQA().catch(err => {
  console.error('QA Script error:', err);
  process.exit(1);
});
