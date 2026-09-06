// ping.js - Скрипт проверки доступности фронтенда (5173) и бэкенда (3000)


async function checkUrl(name, url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const isOk = res.status === 200;
    console.log(`[${isOk ? 'OK' : 'FAIL'}] ${name} (${url}) -> HTTP ${res.status}`);
    return isOk;
  } catch (err) {
    console.error(`[ERROR] ${name} (${url}) -> ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('=== ПРОВЕРКА ДОСТУПНОСТИ СЕРВЕРОВ (PING) ===\n');

  const frontendOk = await checkUrl('Фронтенд (Vite)', 'http://localhost:5173');
  const backendOk = await checkUrl('Бэкенд (Express API Health)', 'http://localhost:3000/api/health');

  console.log('\n----------------------------------------');
  if (frontendOk && backendOk) {
    console.log('✔ ВСЕ СЕРВЕРЫ РАБОТАЮТ И ОТВЕЧАЮТ 200 OK!');
    process.exit(0);
  } else {
    console.error('✖ НЕКОТОРЫЕ СЕРВЕРЫ НЕ ОТВЕТИЛИ 200 OK');
    process.exit(1);
  }
}

main();
