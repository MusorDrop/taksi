const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runE2ETest() {
  console.log('=== ЗАПУСК ПОЛНОГО E2E ТЕСТА КАРПУЛИНГА (PLAYWRIGHT) ===\n');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    locale: 'ru-RU'
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  const timestamp = Date.now();
  const driverUsername = 'driver_' + timestamp;
  const driverPassword = 'DriverPass123!';
  const driverPhone = '+79991234567';
  const driverPlate = 'Е' + Math.floor(100 + Math.random() * 900) + 'КХ96';

  const passengerUsername = 'pass_' + timestamp;
  const passengerPassword = 'PassPass123!';
  const passengerPhone = '+79997654321';

  try {
    console.log('--- ЭТАП 0: Открытие приложения ---');
    await page.goto('http://localhost:5173/taksi/', { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'networkidle' });
    console.log('Приложение открыто на http://localhost:5173/taksi/\n');

    console.log('--- ЭТАП 1: Регистрация водителя и добавление авто ---');
    await page.locator('.MuiTab-root:has-text("Регистрация")').click();
    await page.getByLabel('Логин').fill(driverUsername);
    await page.getByLabel('Пароль').fill(driverPassword);
    await page.getByLabel('Номер телефона *').fill(driverPhone);
    await page.locator('button[type="submit"]:has-text("Зарегистрироваться")').click();

    await page.waitForSelector('.MuiBottomNavigation-root', { timeout: 10000 });
    console.log('✓ Водитель ' + driverUsername + ' успешно зарегистрирован!');

    await page.locator('.MuiBottomNavigationAction-root:has-text("Профиль")').click();
    await page.waitForSelector('text=Гараж автомобилей', { timeout: 8000 });
    await page.locator('button:has-text("Добавить авто")').click();
    await page.getByLabel('Марка и модель *').fill('Skoda Octavia');
    await page.getByLabel('Госномер *').fill(driverPlate);
    await page.getByLabel('Цвет').fill('Белый');
    await page.getByLabel('Количество мест *').fill('4');
    await page.locator('button[type="submit"]:has-text("Сохранить автомобиль")').click();

    await page.waitForSelector('text=Skoda Octavia', { timeout: 8000 });
    await page.waitForSelector('text=' + driverPlate, { timeout: 8000 });
    console.log('✓ Автомобиль Skoda Octavia (' + driverPlate + ', 4 места) добавлен в гараж!');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_driver_car_added.png') });

    console.log('\n--- ЭТАП 2: Создание поездки и проверка Яндекс Карт ---');
    await page.locator('.MuiBottomNavigationAction-root:has-text("Создать")').click();
    await page.waitForSelector('text=Создать поездку', { timeout: 8000 });
    await page.getByLabel('Откуда (Точка А)').fill('Мира 19');
    await page.getByLabel('Куда (Точка Б)').fill('Кампус Новокольцовский');

    console.log('Ожидание расчета маршрута от Яндекс Карт...');
    await page.waitForSelector('text=дистанция', { timeout: 15000 });
    const recText = await page.locator('text=дистанция').innerText();
    console.log('✓ Яндекс Карты вернули данные: "' + recText.trim() + '"');

    if (!recText.includes('км') || !recText.includes('Рекомендация')) {
      throw new Error('Яндекс Карты не предоставили расчет дистанции или цены');
    }

    const applyBtn = page.locator('button:has-text("Применить")');
    await applyBtn.click();
    const priceValue = await page.getByLabel('Ваша цена за место (₽)').inputValue();
    console.log('✓ Рекомендованная цена применена: ' + priceValue + ' ₽');

    const publishBtn = page.locator('button[type="submit"]:has-text("Опубликовать поездку")');
    await publishBtn.click();
    await page.waitForSelector('text=Ваш маршрут опубликован!', { timeout: 10000 });
    console.log('✓ Поездка успешно опубликована!');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_ride_published.png') });

    console.log('\n--- ЭТАП 3: Выход водителя и регистрация пассажира ---');
    await page.locator('.MuiBottomNavigationAction-root:has-text("Профиль")').click();
    await page.locator('button:has-text("Выйти")').click();

    await page.waitForSelector('.MuiTab-root:has-text("Регистрация")', { timeout: 8000 });
    await page.locator('.MuiTab-root:has-text("Регистрация")').click();
    await page.getByLabel('Логин').fill(passengerUsername);
    await page.getByLabel('Пароль').fill(passengerPassword);
    await page.getByLabel('Номер телефона *').fill(passengerPhone);
    await page.locator('button[type="submit"]:has-text("Зарегистрироваться")').click();

    await page.waitForSelector('.MuiBottomNavigation-root', { timeout: 10000 });
    console.log('✓ Пассажир ' + passengerUsername + ' зарегистрирован и авторизован!');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_passenger_logged_in.png') });

    console.log('\n--- ЭТАП 4: Поиск созданной поездки в ленте ---');
    await page.locator('.MuiBottomNavigationAction-root:has-text("Найти")').click();

    const targetRideCard = page.locator('.MuiCard-root', {
      has: page.locator('text=' + driverUsername)
    }).first();

    await targetRideCard.waitFor({ timeout: 10000 });
    const cardTextInitial = await targetRideCard.innerText();
    console.log('✓ Поездка найдена в ленте! Начальное состояние мест: ' + (cardTextInitial.match(/\d+\s*мест/)?.[0] || 'не определено'));
    if (!cardTextInitial.includes('4 мест')) {
      throw new Error('Ожидалось 4 свободных места, получено: ' + cardTextInitial);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_ride_found_in_feed.png') });

    console.log('\n--- ЭТАП 5: Присоединение пассажира к поездке (Join Ride) ---');
    await targetRideCard.click();
    await page.waitForTimeout(500);

    const joinBtn = targetRideCard.locator('button:has-text("Присоединиться")');
    await joinBtn.waitFor({ state: 'visible', timeout: 5000 });
    await joinBtn.click();

    await page.waitForSelector('.MuiCard-root:has-text("3 мест")', { timeout: 8000 });
    console.log('✓ Количество мест успешно уменьшилось с 4 до 3!');

    const leaveBtn = targetRideCard.locator('button:has-text("Отменить участие")');
    await leaveBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Кнопка "Отменить участие" активна!');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_ride_joined.png') });

    console.log('\n--- ЭТАП 6: Отмена участия в поездке (Leave Ride) ---');
    await leaveBtn.click();

    await page.waitForSelector('.MuiCard-root:has-text("4 мест")', { timeout: 8000 });
    console.log('✓ Место успешно вернулось: снова 4 свободных места!');

    await targetRideCard.locator('button:has-text("Присоединиться")').waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Кнопка изменилась обратно на "Присоединиться"!');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_ride_left.png') });

    console.log('\n--- ЭТАП 7: Вход под водителем и отмена поездки (Delete Ride) ---');
    await page.locator('.MuiBottomNavigationAction-root:has-text("Профиль")').click();
    await page.locator('button:has-text("Выйти")').click();

    await page.waitForSelector('.MuiTab-root:has-text("Вход")', { timeout: 8000 });
    await page.locator('.MuiTab-root:has-text("Вход")').click();
    await page.getByLabel('Логин').fill(driverUsername);
    await page.getByLabel('Пароль').fill(driverPassword);
    await page.locator('button[type="submit"]:has-text("Войти")').click();

    await page.waitForSelector('.MuiBottomNavigation-root', { timeout: 10000 });
    console.log('✓ Водитель ' + driverUsername + ' успешно вошел в систему!');

    await page.locator('.MuiBottomNavigationAction-root:has-text("Поездки")').click();
    await page.locator('.MuiTab-root:has-text("Я водитель")').click();

    const driverCard = page.locator('.MuiCard-root', {
      has: page.locator('text=Кампус Новокольцовский')
    }).first();
    await driverCard.waitFor({ timeout: 8000 });

    await driverCard.click();
    await page.waitForTimeout(500);

    const deleteBtn = driverCard.locator('button:has-text("Отменить поездку")');
    await deleteBtn.waitFor({ state: 'visible', timeout: 5000 });
    await deleteBtn.click();

    const confirmDeleteBtn = page.locator('button:has-text("Да, отменить поездку")');
    await confirmDeleteBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmDeleteBtn.click();

    await page.waitForSelector('text=Вы ещё не создали ни одного маршрута', { timeout: 8000 });
    console.log('✓ Поездка успешно удалена из списка водителя!');

    await page.locator('.MuiBottomNavigationAction-root:has-text("Найти")').click();
    await page.waitForTimeout(1000);
    const deletedInFeed = await page.locator('.MuiCard-root:has-text("' + driverUsername + '")').count();
    console.log('Количество карточек удаленной поездки в общей ленте: ' + deletedInFeed);
    if (deletedInFeed !== 0) {
      throw new Error('Удаленная поездка все еще отображается в общей ленте!');
    }
    console.log('✓ Поездка полностью удалена и отсутствует в общей ленте!');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_ride_deleted.png') });

    console.log('\n======================================================');
    console.log('ВСЕ 7 ЭТАПОВ E2E ТЕСТИРОВАНИЯ УСПЕШНО ПРОЙДЕНЫ БЕЗ ОШИБОК!');
    console.log('======================================================\n');

  } catch (error) {
    console.error('\n❌ ОШИБКА В ХОДЕ ВЫПОЛНЕНИЯ E2E ТЕСТА:', error);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_screenshot.png') });
    throw error;
  } finally {
    await browser.close();
  }
}

runE2ETest().catch(err => {
  console.error(err);
  process.exit(1);
});