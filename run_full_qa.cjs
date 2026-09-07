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
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  const consoleLogs = [];
  const errors = [];
  const networkErrors = [];

  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', err => {
    errors.push(err.toString());
  });
  page.on('requestfailed', req => {
    networkErrors.push({ url: req.url(), error: req.failure()?.errorText });
  });

  console.log('--- 1. Navigating to Login Screen ---');
  await page.goto('http://localhost:5173/taksi/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(screenshotsDir, '00_auth_screen.png') });
  console.log('Saved 00_auth_screen.png');

  console.log('--- 2. Logging in as alex_smirnov ---');
  await page.locator('input').nth(0).fill('alex_smirnov');
  await page.locator('input').nth(1).fill('StudentPass123!');
  await page.locator('button[type="submit"]').click();

  // Wait for feed to appear
  await page.waitForSelector('.MuiCard-root', { timeout: 10000 });
  await page.waitForTimeout(1500);

  console.log('--- 3. Verifying Find Rides Feed ---');
  const cardCount = await page.locator('.MuiCard-root').count();
  console.log(`Rendered ${cardCount} ride cards in feed.`);

  const feedText = await page.evaluate(() => document.body.innerText);
  const containsUrFU1 = feedText.includes('Кампус Новокольцовский');
  const containsUrFU2 = feedText.includes('Главный учебный корпус УрФУ');
  console.log('Contains Novokoltsovsky campus:', containsUrFU1);
  console.log('Contains GUK UrFU:', containsUrFU2);

  // Take screenshot 01_rides_feed.png
  await page.screenshot({ path: path.join(screenshotsDir, '01_rides_feed.png') });
  console.log('Saved 01_rides_feed.png');

  console.log('--- 4. Expanding Ride Details & Checking Map / Polyline ---');
  // Find expand button of first card
  const expandBtn = page.locator('button[aria-label*="детали поездки"]').first();
  await expandBtn.click();

  // Wait for RouteMap container
  await page.waitForSelector('text=Маршрут на карте', { timeout: 10000 });
  console.log('Found "Маршрут на карте" header');

  // Wait 4s for Yandex Maps and polyline rendering
  await page.waitForTimeout(4000);

  // Check if map container has rendered canvas or svg or ymaps elements
  const mapInfo = await page.evaluate(() => {
    const mapBox = document.querySelector('.ymaps-2-1-margin') ||
                    document.querySelector('ymaps') ||
                    document.querySelector('[class*="ymaps"]') ||
                    document.querySelector('canvas') ||
                    document.querySelector('svg');
    return {
      hasMapElement: Boolean(mapBox),
      mapTagName: mapBox?.tagName,
      mapClass: mapBox?.className
    };
  });
  console.log('Map element inspection:', mapInfo);

  // Screenshot 02_ride_details_map.png
  await page.screenshot({ path: path.join(screenshotsDir, '02_ride_details_map.png') });
  console.log('Saved 02_ride_details_map.png');

  console.log('--- 5. Opening Reviews Modal from Card ---');
  const ratingBox = page.locator('text=★ 5.0').first();
  if (await ratingBox.isVisible()) {
    await ratingBox.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotsDir, '04_reviews_modal.png') });
    console.log('Saved 04_reviews_modal.png');

    const closeBtn = page.locator('button[aria-label="close"], button:has-text("Закрыть")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
  }

  console.log('--- 6. Navigating to Profile Screen ---');
  await page.locator('button:has-text("Профиль")').click();
  await page.waitForTimeout(1500);

  // Take screenshot 03_profile_reviews.png
  await page.screenshot({ path: path.join(screenshotsDir, '03_profile_reviews.png') });
  console.log('Saved 03_profile_reviews.png');

  console.log('--- 7. Mobile Viewport Inspection ---');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('button:has-text("Найти поездку")').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '05_mobile_feed.png') });
  console.log('Saved 05_mobile_feed.png');

  console.log('--- 8. Diagnostics Summary ---');
  console.log('Unhandled page errors:', errors.length);
  errors.forEach(e => console.log('  Page Error:', e));

  const realConsoleErrors = consoleLogs.filter(c => c.type === 'error' && !c.text.includes('net::ERR_ABORTED'));
  console.log('Console errors:', realConsoleErrors.length);
  realConsoleErrors.forEach(c => console.log('  Console Error:', c.text));

  const realNetworkErrors = networkErrors.filter(n => !n.url.includes('favicon') && n.error !== 'net::ERR_ABORTED');
  console.log('Real network errors:', realNetworkErrors.length);
  realNetworkErrors.forEach(n => console.log('  Network Error:', n.url, n.error));

  await browser.close();
  console.log('QA execution completed successfully!');
}

runQA().catch(err => {
  console.error('QA Script error:', err);
  process.exit(1);
});
