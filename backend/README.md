# 🚗 Серверная часть платформы «Попутка» (Backend API)

Backend-сервис платформы совместных поездок (карпулинг) для студентов и сотрудников УрФУ. Сервис обеспечивает гео-пространственный поиск маршрутов, управление поездками, расчет тарифов, безопасность бронирований и двустороннюю систему репутации.

---

## 🛠 Технологический стек

- **Среда выполнения:** [Node.js](https://nodejs.org/) (v20+)
- **Фреймворк:** [Express.js v5](https://expressjs.com/)
- **База данных:** [PostgreSQL 15+](https://www.postgresql.org/) с расширением **[PostGIS](https://postgis.net/)** (пространственные типы `Point`, `LineString`, сферическая тригонометрия, индексы `GIST`)
- **Аутентификация и безопасность:**
  - [JWT (jsonwebtoken)](https://github.com/auth0/node-jsonwebtoken) — выпуск и валидация токенов доступа
  - [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — безопасное хеширование паролей (соль 10 раундов)
  - [Helmet](https://helmetjs.github.io/) — установка защитных HTTP-заголовков
  - [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) — защита от брутфорса и лимитирование поисковых запросов
  - [cors](https://github.com/expressjs/cors) — настройка Cross-Origin Resource Sharing
  - [multer](https://github.com/expressjs/multer) — безопасная загрузка аватарок с проверкой mime-типов
- **Гео-сервисы и интеграция с Яндекс Картами:**
  - Яндекс Геокодер HTTP API (прямое и обратное геокодирование)
  - Яндекс Suggest API (подсказки адресов в границах Екатеринбурга)
  - Яндекс Router API (маршрутизация и полилинии дорог)
  - Встроенный кэш геокодирования в PostgreSQL (`geocode_cache`) и локальный словарь ключевых ориентиров УрФУ

---

## 🚀 Быстрый запуск

### 1. Предварительные требования
- Установлен **Node.js 20+** и **npm**.
- Установлен и запущен сервер **PostgreSQL 15+** с установленным расширением **PostGIS**.
- Создана база данных (например, `taksi`).

### 2. Установка зависимостей
```bash
cd backend
npm install
```

### 3. Настройка переменных окружения (`.env`)
Создайте файл `.env` в корне папки `backend/`:

```env
# Параметры сервера
PORT=3000
NODE_ENV=development
APP_TIMEZONE=Asia/Yekaterinburg
CORS_ORIGIN=http://localhost:5173

# Секрет для подписи JWT-токенов
JWT_SECRET=super-secret-jwt-key-change-in-production

# Подключение к PostgreSQL с PostGIS:
# Вариант 1: Через единый URL
DATABASE_URL=postgres://postgres:password@localhost:5432/taksi

# Вариант 2: Через раздельные переменные (если не указан DATABASE_URL)
# PGHOST=localhost
# PGPORT=5432
# PGUSER=postgres
# PGPASSWORD=password
# PGDATABASE=taksi

# Ключи API Яндекс Карт (Кабинет Разработчика Яндекса):
# 1. API Геокодера и JavaScript API (для прямого/обратного геокодирования)
YANDEX_MAPS_API_KEY=your_yandex_maps_api_key

# 2. API Подсказок (Suggest API) для автокомплита адресов
YANDEX_SUGGEST_API_KEY=your_yandex_suggest_api_key

# 3. Router API (Матрица расстояний и маршрутизация для авто)
YANDEX_ROUTER_API_KEY=your_yandex_router_api_key
```

> [!TIP]
> Если ключи Яндекса не указаны, сервис продолжит функционировать в резервном режиме: геокодирование использует встроенный словарь кампусов УрФУ и кэш БД, а дистанция рассчитывается по сфере Земли через PostGIS `ST_DistanceSphere` или формулу гаверсинусов.

### 4. Запуск миграций базы данных
Миграции выполняются автоматически скриптом `migrate.js`, который фиксирует примененные файлы в таблице `schema_migrations`:

```bash
npm run migrate
```

Миграция `001_initial_schema.sql` выполнит:
- Подключение расширений `uuid-ossp` и `postgis`;
- Создание типов `user_role`, `match_status`;
- Создание таблиц: `users`, `vehicles`, `rides`, `matches`, `ride_instances`, `reviews`, `geocode_cache`;
- Настройку пространственных индексов `GIST` на координаты точек старта/финиша и индексов ускорения поиска.

### 5. Запуск сервера
```bash
# Обычный запуск
npm start

# Сервер запустится по адресу: http://localhost:3000
```

### 6. Запуск автоматических тестов (Smoke Tests)
Сервер содержит набор из 9 автоматизированных сквозных smoke-тестов:
```bash
npm test
```

---

## 🧭 Ключевые модули и бизнес-логика

### 1. Пространственный гео-поиск (PostGIS)
Поиск попутных маршрутов производится с помощью функции `ST_DWithin` по координатам посадки и высадки в радиусе (по умолчанию 1000 метров). Запросы используют сферический тип `geography` (WGS 84 / EPSG:4326):
```sql
ST_DWithin(
  r.start_point::geography,
  ST_SetSRID(ST_MakePoint(search_lon, search_lat), 4326)::geography,
  radius_in_meters
)
```

### 2. Прозрачное ценообразование за место
- Полный отказ от сложной модели Split Fare: действует строго фиксированная цена за 1 посадочное место (`base_price`).
- Базовый тариф: **6 ₽ за 1 км** пути (рассчитывается через `ST_DistanceSphere` или Яндекс Router API).
- Часы пик (Asia/Yekaterinburg):
  - Утренний пик: `07:30 – 09:30` (выезд на пары);
  - Вечерний пик: `17:00 – 19:00` (возвращение домой);
  - Повышающий коэффициент: **x1.3**.
- Водитель может согласиться с рекомендованной ценой или задать свою фиксированную ставку.

### 3. Гараж автомобилей и вместимость
- Водитель вносит авто в личный гараж (`POST /api/vehicles`) с указанием госномера, марки, цвета и вместимости (`seats`, от 1 до 8 мест).
- Создание поездок **без привязанного автомобиля строго заблокировано** на уровне бизнес-логики бэкенда.

### 4. Одноразовые и регулярные поездки
- **Одноразовые (`one_off`):** привязаны к конкретной дате и времени.
- **Регулярные (`regular`):** привязаны к дням недели (например, `Пн, Ср, Пт`). Пассажир при бронировании может указать конкретный день недели (`selected_day`).

### 5. Безопасность бронирования
- Защита от овербукинга и race conditions реализована через атомарные транзакции PostgreSQL с блокировкой строк:
  ```sql
  BEGIN;
  SELECT available_seats FROM rides WHERE id = $1 FOR UPDATE;
  -- Проверка и списание места
  COMMIT;
  ```

---

## 📡 Спецификация REST API

### Служебные эндпоинты
| Метод | URL | Описание | Доступ |
|---|---|---|---|
| `GET` | `/api/health` | Проверка статуса сервера и подключения к PostgreSQL/PostGIS | Публичный |
| `GET` | `/api/suggest` | Подсказки адресов Екатеринбурга через Yandex Suggest с лимитером запросов | Публичный |

### Аутентификация и профиль (`/api/auth`)
| Метод | URL | Описание | Доступ |
|---|---|---|---|
| `POST` | `/api/auth/register` | Регистрация (username, password >= 8 симв, phone, first_name) | Публичный |
| `POST` | `/api/auth/login` | Авторизация и получение JWT-токена | Публичный |
| `GET` | `/api/auth/me` | Данные текущего пользователя (рейтинг, контакты, авто) | Bearer JWT |
| `PATCH` | `/api/auth/me` | Обновление контактов (телефон, Telegram-никнейм) | Bearer JWT |
| `POST` | `/api/auth/me/avatar` | Загрузка аватара (multipart/form-data, до 5 МБ) | Bearer JWT |

### Гараж автомобилей (`/api/vehicles`)
| Метод | URL | Описание | Доступ |
|---|---|---|---|
| `GET` | `/api/vehicles` | Получение списка автомобилей водителя | Bearer JWT |
| `POST` | `/api/vehicles` | Добавление автомобиля (`brand`, `color`, `license_plate`, `seats`) | Bearer JWT |
| `PATCH` | `/api/vehicles/:id` | Редактирование параметров автомобиля | Bearer JWT (владелец) |

### Поездки (`/api/rides`)
| Метод | URL | Описание | Доступ |
|---|---|---|---|
| `GET` | `/api/rides` | Поиск поездок (фильтры: `start_lat`, `start_lon`, `end_lat`, `end_lon`, `radius`, `time`) | Публичный |
| `POST` | `/api/rides` | Создание поездки водителем (требуется `vehicle_id`) | Bearer JWT (водитель) |
| `PATCH` | `/api/rides/:id` | Редактирование параметров активной поездки | Bearer JWT (создатель) |
| `POST` | `/api/rides/:id/join` | Бронирование места (опционально `selected_day` для регулярных) | Bearer JWT (пассажир) |
| `POST` | `/api/rides/:id/leave` | Отмена участия в поездке с возвратом места | Bearer JWT (пассажир) |
| `DELETE` | `/api/rides/:id/passengers/:passengerId` | Исключение пассажира водителем | Bearer JWT (водитель) |

### Отзывы и рейтинги (`/api/reviews`)
| Метод | URL | Описание | Доступ |
|---|---|---|---|
| `GET` | `/api/reviews` | Получение списка отзывов (фильтры по `user_id`, `ride_id`) | Публичный |
| `POST` | `/api/reviews` | Публикация отзыва и оценки (1–5 звезд) с пересчетом рейтинга | Bearer JWT |

### Панель администратора (`/api/admin`)
| Метод | URL | Описание | Доступ |
|---|---|---|---|
| `GET` | `/api/admin/stats` | Агрегированная статистика сервиса | Bearer JWT (администратор) |
| `GET` | `/api/admin/users` | Список пользователей с фильтрацией | Bearer JWT (администратор) |
| `POST` | `/api/admin/block` | Блокировка/разблокировка учетной записи пользователя | Bearer JWT (администратор) |

---

## 🗄 Схема базы данных

```mermaid
erDiagram
    USERS ||--o{ VEHICLES : "владеет (owns)"
    USERS ||--o{ RIDES : "публикует (drives)"
    USERS ||--o{ REVIEWS : "пишет / получает"
    RIDES ||--o{ MATCHES : "содержит брони"
    USERS ||--o{ MATCHES : "участвует как пассажир"

    USERS {
        uuid id PK
        varchar username "Уникальный логин"
        varchar password_hash "Хэш пароля (bcrypt)"
        varchar first_name "Имя"
        varchar last_name "Фамилия"
        varchar phone "Обязательный телефон"
        enum role "driver | passenger | both"
        decimal rating "Средний рейтинг (1.00 - 5.00)"
        boolean is_blocked "Статус блокировки"
        boolean is_verified "Верификация аккаунта"
        varchar avatar_url "Путь к аватару"
        timestamp created_at
    }

    VEHICLES {
        uuid id PK
        uuid driver_id FK
        varchar brand "Марка и модель"
        varchar color "Цвет"
        varchar license_plate "Госномер (UNIQUE)"
        int seats "Количество мест (1-8)"
        timestamp created_at
    }

    RIDES {
        uuid id PK
        uuid driver_id FK
        uuid vehicle_id FK
        timestamp departure_time "Время отправления"
        geometry start_point "Точка старта (Point 4326)"
        geometry end_point "Точка финиша (Point 4326)"
        geometry route_line "Линия маршрута (LineString 4326)"
        int total_seats "Всего мест"
        int available_seats "Доступно мест"
        varchar status "planned | active | completed | cancelled"
        decimal base_price "Фиксированная цена за место"
        varchar ride_type "one_off | regular"
        varchar regular_days "Дни недели (Пн, Вт...)"
        timestamp created_at
    }

    MATCHES {
        uuid id PK
        uuid ride_id FK
        uuid passenger_id FK
        decimal agreed_price "Зафиксированная стоимость"
        enum status "accepted | completed | cancelled"
        varchar selected_day "Выбранный день недели"
        timestamp created_at
    }

    REVIEWS {
        uuid id PK
        uuid ride_id FK
        uuid reviewer_id FK
        uuid reviewee_id FK
        int rating "Оценка от 1 до 5"
        text comment "Текст отзыва"
        timestamp created_at
    }

    GEOCODE_CACHE {
        uuid id PK
        text address_query "Поисковая строка адреса (UNIQUE)"
        double_precision longitude "Долгота"
        double_precision latitude "Широта"
        text full_address "Стандартизированный адрес"
        timestamp created_at
    }
```
