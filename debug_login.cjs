const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function debugLogin() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log('API RES:', res.status(), res.url());
    }
  });

  await page.goto('http://localhost:5173/taksi/');
  await page.waitForTimeout(1000);

  console.log('Filling form...');
  const usernameInput = page.locator('input').nth(0);
  const passwordInput = page.locator('input').nth(1);

  await usernameInput.fill('alex_smirnov');
  await passwordInput.fill('StudentPass123!');

  console.log('Clicking button...');
  await page.locator('button[type=submit]').click();

  await page.waitForTimeout(3000);

  // Check alert or error on page
  const alertText = await page.locator('.MuiAlert-message').textContent().catch(() => null);
  console.log('Alert text on page:', alertText);

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body text preview:\n', bodyText.substring(0, 300));

  await page.screenshot({ path: 'C:\\Users\\denis\\Documents\\antigravity\\taksi\\taksi\\demo_screenshots\\debug_login.png' });
  await browser.close();
}

debugLogin().catch(console.error);
