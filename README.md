<div align="center">

# 🚕 Попутка ИИ (УрФУ Карпулинг)

### Интеллектуальный сервис совместных поездок для студентов и преподавателей УрФУ
**Маршрут: Главный учебный корпус (ГУК) ⇄ Кампус «Новокольцовский»**

---

[![React 19](https://img.shields.io/badge/React-19.2-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![MUI v7](https://img.shields.io/badge/MUI-v7.3-007FFF?style=for-the-badge&logo=mui&logoColor=white)](https://mui.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-5.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.6-2D725C?style=for-the-badge&logo=postgis&logoColor=white)](https://postgis.net/)
[![Yandex Maps](https://img.shields.io/badge/Yandex_Maps-API_2.1-E61400?style=for-the-badge&logo=yandex&logoColor=white)](https://yandex.ru/dev/maps/)
[![GigaChat-Pro](https://img.shields.io/badge/GigaChat-Pro_AI-0DA95F?style=for-the-badge&logo=sberbank&logoColor=white)](https://developers.sber.ru/portal/products/gigachat)

</div>

---

## 📖 О проекте

**«Попутка ИИ»** — специализированный сервис совместных поездок (карпулинг), созданный для решения транспортной задачи студентов и преподавателей Уральского федерального университета (УрФУ). Сервис связывает исторические корпуса в центре Екатеринбурга (**ГУК на ул. Мира, 19**, корпуса на пр. Ленина и ул. Тургенева) с удаленным кампусом в **Новокольцовском районе** (общежития №1–5, учебные корпуса ИРИТ-РТФ, ЭУИМ, спортивный кластер).

### ⚖️ Сравнение вариантов поездки

| Критерий | 🚌 Автобусы (общественный транспорт) | 🚕 Коммерческое такси | 🚗 Попутка ИИ (УрФУ) |
| :--- | :---: | :---: | :---: |
| **Время в пути (час пик)** | 60–90 мин (с пересадками) | 25–40 мин | **20–35 мин (прямой маршрут)** |
| **Средняя стоимость** | ~35–70 ₽ | 450–900 ₽ | **70–150 ₽ (компенсация бензина)** |
| **Комфорт и места** | Переполненный салон, стоя | Индивидуально | **Гарантированное сидячее место** |
| **Окружение** | Случайные пассажиры | Незнакомый водитель | **Закрытое студенческое комьюнити** |
| **Поиск поездки** | По расписанию на остановках | Динамический тариф агрегатора | **Умный AI-поиск на естественном языке** |

---

## 🌟 Ключевые возможности

| Функция | Описание и технические детали |
| :--- | :--- |
| 🗺️ **Интеграция Yandex Maps** | Интерактивные карты с точной отрисовкой маршрутов по реальным дорогам (`LineString`), подсказки корпусов и адресов Екатеринбурга через Yandex Suggest & Places API, двухуровневое кэширование геокоординат в PostgreSQL (`geocode_cache`). |
| 🤖 **GigaChat-Pro (AI парсинг)** | Нейросетевая обработка запросов на естественном языке (например, *«Завтра около 8:30 утра нужно от ГУКа в Новокольцово»*). Модель автоматически извлекает параметры маршрута, время и фильтрует доступные поездки. |
| 📍 **PostGIS гео-поиск** | Пространственные индексы GiST, точный расчет расстояний и радиусов доступности (`ST_DWithin`, `ST_Distance`). Позволяет пассажирам находить водителей, чей маршрут пролегает рядом. |
| 🛡️ **Защита от овербукинга** | Атомарные транзакции базы данных с блокировкой строк (`SELECT ... FOR UPDATE`). Полностью исключает конфликт одновременного бронирования одного и того же места. |
| 🔐 **JWT-админка & Безопасность** | Ролевой контроль доступа (`user`, `admin`), панель управления и модерации, защита заголовков через `helmet`, лимитирование частоты запросов `express-rate-limit` и безопасное хеширование паролей (`bcryptjs`). |
| 🚗 **Гараж автомобилей & Честный тариф** | Учет автомобилей водителей (1–8 мест), валидация вместимости, расчет стоимости по прозрачной формуле (базовый тариф 6 ₽/км с пиковым коэффициентом x1.3: утро `07:30–09:30`, вечер `17:00–19:00`). |
| ⭐ **Двусторонняя репутация** | Оценка поездок (1–5 звезд) с взаимными отзывами и автоматическим пересчетом рейтинга водителей и пассажиров. |

## 🛠 Технологический стек

### 💻 Frontend
| Технология | Назначение | Бейдж |
| :--- | :--- | :--- |
| **React 19** | Реактивная библиотека пользовательского интерфейса | ![React](https://img.shields.io/badge/React-19.2-20232A?logo=react&logoColor=61DAFB) |
| **Vite 8** | Высокоскоростной инструмент сборки и dev-сервер | ![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white) |
| **MUI v7** | Компонентная система Material UI + светлая/тёмная темы | ![MUI](https://img.shields.io/badge/MUI-v7.3-007FFF?logo=mui&logoColor=white) |
| **TypeScript 5.9** | Строгая статическая типизация модулей и компонентов | ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white) |
| **React Router 7** | Клиентская декларативная маршрутизация SPA | ![Router](https://img.shields.io/badge/React_Router-v7-CA4245?logo=reactrouter&logoColor=white) |

### ⚙️ Backend & База данных
| Технология | Назначение | Бейдж |
| :--- | :--- | :--- |
| **Node.js 20+** | Серверная среда выполнения JavaScript | ![NodeJS](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white) |
| **Express 5** | RESTful HTTP/JSON микросервисный каркас | ![Express](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white) |
| **PostgreSQL 15+** | Реляционная СУБД с поддержкой транзакций ACID | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white) |
| **PostGIS 3.6** | Геопространственное расширение и GiST-индексация | ![PostGIS](https://img.shields.io/badge/PostGIS-3.6-2D725C?logo=postgis&logoColor=white) |
| **JWT + Bcrypt** | Авторизация RFC 7519 и безопасное хеширование паролей | ![Security](https://img.shields.io/badge/Auth-JWT_%2B_Bcrypt-blueviolet) |

### 🌐 Внешние интеграции & ИИ
| Сервис / API | Назначение | Бейдж |
| :--- | :--- | :--- |
| **Yandex Maps JS API 2.1** | Интерактивная карта, маркеры и дорожная сеть | ![Yandex](https://img.shields.io/badge/Yandex-Maps_API_2.1-red?logo=yandex&logoColor=white) |
| **Yandex Places / Suggest** | Автодополнение адресов и поиск кампусов УрФУ | ![Yandex](https://img.shields.io/badge/Yandex-Places_%26_Suggest-red?logo=yandex&logoColor=white) |
| **GigaChat-Pro (Сбер AI)** | NLP-парсинг неструктурированных текстовых запросов | ![GigaChat](https://img.shields.io/badge/Sber-GigaChat_Pro-107C41?logo=sberbank&logoColor=white) |

---

## 🏛 Архитектура решения

```mermaid
graph TD
    User["Студент / Преподаватель (Браузер / Мобильный)"]
    
    subgraph FrontendApp ["Клиентский интерфейс (Frontend)"]
        UI["React 19 + MUI v7 SPA"]
        MapClient["Яндекс Карты JS API 2.1 (useRouteMap)"]
        SuggestClient["Yandex Suggest API (useAddressSuggest)"]
    end

    subgraph BackendApp ["Сервер приложений (Backend)"]
        Gateway["Express 5.2 API Gateway"]
        AuthMiddleware["JWT Auth & Role Guard (User / Admin)"]
        RouteController["Rides & Booking Controller"]
        AIController["GigaChat NLP Parser"]
    end

    subgraph DatabaseLayer ["Слой данных"]
        PG[("PostgreSQL 15+")]
        GIS[("PostGIS 3.6 Гео-индексы")]
        Cache[("Кэш геокодирования geocode_cache")]
    end

    subgraph ExternalCloud ["Внешние облачные API"]
        YandexCloud["Yandex Geocoder & Router API"]
        GigaChatCloud["Sber GigaChat-Pro API (OAuth 2.0)"]
    end

    User --> UI
    UI --> MapClient
    UI --> SuggestClient
    UI -->|HTTPS REST + JWT Bearer| Gateway

    Gateway --> AuthMiddleware
    AuthMiddleware --> RouteController
    AuthMiddleware --> AIController

    RouteController -->|"SELECT ... FOR UPDATE (Анти-овербукинг)"| PG
    RouteController -->|ST_DWithin / GiST поиск| GIS
    RouteController --> Cache

    RouteController -->|Геокодирование / Маршрутизация| YandexCloud
    AIController -->|NLP Структурирование запросов| GigaChatCloud
```

---

## 🚀 Быстрый старт (Quick Start)

### 📋 Предварительные требования
- **Node.js** версии `20.x` или новее
- **PostgreSQL 15+** с установленным расширением **PostGIS**
- Ключ разработчика **Yandex Maps API**
- Учетные данные **GigaChat API** (Client ID / Client Secret)

---

### 1️⃣ Настройка и запуск серверной части (Backend)

```bash
# Перейдите в директорию бэкенда
cd backend

# Установите зависимости
npm install

# Создайте файл .env (см. backend/README.md для примера всех переменных)
# Настройте подключение к БД PostgreSQL и внешние ключи:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=taksi
# DB_USER=postgres
# DB_PASSWORD=your_password
# JWT_SECRET=your_jwt_secret_key
# YANDEX_MAPS_API_KEY=your_yandex_key
# GIGACHAT_CLIENT_ID=your_client_id
# GIGACHAT_CLIENT_SECRET=your_client_secret

# Примените схему и миграции базы данных (PostgreSQL + PostGIS):
npm run migrate

# Запустите API сервер (по умолчанию порт 3000):
npm start
```

Проверка работоспособности бэкенда (Smoke-тест):
```bash
npm run test:smoke
```

---

### 2️⃣ Настройка и запуск клиентской части (Frontend)

В отдельном терминале выполните:

```bash
# Перейдите в директорию фронтенда
cd frontend

# Установите зависимости
npm install

# Запустите клиентский dev-сервер Vite (порт 5173):
npm run dev
```

Откройте веб-приложение в браузере: **`http://localhost:5173`**

---

## 📂 Структура репозитория

```text
taksi/
├── backend/                  # REST API сервер на Express 5 & PostgreSQL
│   ├── db/                   # Миграции схемы БД, подключение pg pool, фиксы индексов
│   ├── middleware/           # JWT аутентификация, валидаторы, helmet, rate-limit
│   ├── routes/               # Эндпоинты: auth, rides, bookings, cars, reviews, admin
│   ├── services/             # Интеграции: GigaChat AI парсинг, Yandex геокодер
│   ├── index.js              # Точка входа Express бэкенда
│   └── README.md             # Детальная документация API бэкенда
│
├── frontend/                 # Клиентское приложение React 19 + Vite + MUI v7
│   ├── src/
│   │   ├── components/       # UI компоненты (карточки, модалки, списки)
│   │   ├── hooks/            # Хуки Яндекс Карт (useRouteMap, useAddressSuggest)
│   │   ├── pages/            # Страницы: поиск, поездки, профиль, гараж, админка
│   │   ├── theme/            # Темизация MUI (светлая / темная палитра)
│   │   └── App.tsx           # Корневой компонент и декларативный роутер
│   ├── vite.config.ts        # Конфигурация Vite
│   └── README.md             # Детальная документация фронтенда
│
└── README.md                 # Главная документация проекта
```

---

## 📚 Документация подсистем

- 📘 **[Backend API Документация](./backend/README.md)** — архитектура Express.js, PostgreSQL/PostGIS, схемы таблиц, миграции, `.env`, спецификация эндпоинтов, Яндекс Карты и GigaChat.
- 📙 **[Frontend Документация](./frontend/README.md)** — стек React 19 + Vite 8 + MUI v7, хуки Яндекс Карт API 2.1 (`useRouteMap`, `useAddressSuggest`), экраны и запуск.

---

<div align="center">
  <sub>Разработано с ❤️ для студентов и преподавателей УрФУ</sub>
</div>

