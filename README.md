<div align="center">
  <h1>🚕 Попутка — Карпулинг для УрФУ</h1>
  <p><b>Умный сервис совместных поездок для студентов и преподавателей Уральского федерального университета.</b></p>

  <p>
    <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
    <img src="https://img.shields.io/badge/PostgreSQL-15+-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/PostGIS-Spatial-green?style=for-the-badge&logo=postgis&logoColor=white" alt="PostGIS" />
    <img src="https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.x-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/MUI-v7-007FFF?style=for-the-badge&logo=mui&logoColor=white" alt="MUI" />
    <img src="https://img.shields.io/badge/Yandex_Maps-API_2.1-red?style=for-the-badge&logo=yandex&logoColor=white" alt="Yandex Maps" />
  </p>
</div>

---

## 📌 О проекте

**«Попутка»** решает проблему долгой и дорогой дороги студентов между центром Екатеринбурга (корпуса на Мира, Ленина, Тургенева) и новым кампусом в **Новокольцовском**. 

Сервис объединяет студентов-водителей и попутчиков:
- **Пассажиры** добираются до кампуса с комфортом и в 4–6 раз дешевле коммерческого такси.
- **Водители** компенсируют расходы на бензин без необходимости подрабатывать в классических службах такси.

---

## ✨ Ключевые возможности

- 🗺️ **Умный автокомплит с геокодингом:** Мгновенный ввод адресов Екатеринбурга и корпусов УрФУ через Яндекс Карты API 2.1 и Yandex Suggest с кэшированием в PostgreSQL и резервным оффлайн-словарем ориентиров.
- ⭐ **Система отзывов и рейтингов:** Двусторонняя честная оценка поездок (от 1 до 5 звезд) с мгновенным пересчетом рейтинга пользователей в реальном времени.
- 🧮 **Умный калькулятор цены маршрута:** Прозрачный расчет фиксированной стоимости посадочного места (базовый тариф 6 ₽/км, повышающий коэффициент x1.3 в утренние и вечерние часы пик, без скрытых пересчетов Split Fare).
- 📱 **Адаптивный дизайн и PWA:** Приложение отлично работает на смартфонах и десктопах, поддерживает светлую и темную темы, безопасные зоны экранов (safe-area), а также звонок водителю (`tel:`) и чат в Telegram в один тап.
- 🚗 **Гараж автомобилей и надежность:** Контроль свободных мест в авто (от 1 до 8), блокировка публикации поездок без добавленного автомобиля и защита от овербукинга через атомарные транзакции с блокировкой строк (`FOR UPDATE`).

---

## 🚀 Быстрый старт

### 1. Серверная часть (Backend)
```bash
cd backend
npm install

# Создайте файл .env (см. пример в backend/README.md)
# Примените миграции базы данных PostgreSQL + PostGIS:
npm run migrate

# Запустите сервер API (порт 3000):
npm start
```

### 2. Клиентская часть (Frontend)
```bash
# В отдельном терминале:
cd frontend
npm install

# Запустите клиентский dev-сервер Vite (порт 5173):
npm run dev
```

Откройте в браузере: **`http://localhost:5173`**

---

## 📚 Документация подсистем

- 📘 **[Backend API Документация](./backend/README.md)** — архитектура Express.js, PostgreSQL/PostGIS, схемы таблиц, миграции, переменные `.env`, API-эндпоинты и ключи Яндекс Карт.
- 📙 **[Frontend Документация](./frontend/README.md)** — стек React 19 + Vite + MUI, хуки взаимодействия с Яндекс Картами API 2.1 (`useRouteMap`, `useAddressSuggest`), структура экранов и запуск.

---
*Сделано с ❤️ для студентов и преподавателей УрФУ*
