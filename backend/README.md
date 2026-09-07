# 🚗 Серверная часть платформы «Попутка» (Backend API)

API-сервис карпулинга для студентов и сотрудников УрФУ. Обеспечивает гео-пространственный поиск маршрутов, управление поездками, расчет тарифов, безопасность бронирований и двусторонний рейтинг.

---

## 🛠 Стек технологий

- **Среда выполнения:** [Node.js v20+](https://nodejs.org/) / [Express.js v5](https://expressjs.com/)
- **СУБД:** [PostgreSQL 15+](https://www.postgresql.org/) с расширением **[PostGIS 3.6+](https://postgis.net/)** (типы `Point`, `LineString`, пространственные индексы `GIST`)
- **Безопасность:** JWT (HS256), [bcryptjs](https://github.com/dcodeIO/bcrypt.js) (соль 10 раундов), Helmet, CORS, express-rate-limit, Multer (проверка magic bytes)
- **Гео-сервисы:** Яндекс Карты API (Геокодер, Suggest API, Places API, Router API), встроенный кэш геокодирования (`geocode_cache`) и словарь ориентиров УрФУ
- **ИИ-интеграция:** GigaChat API (Lite / Pro) для семантического распознавания текстовых запросов

---

## 🚀 Быстрый запуск

### 1. Установка и настройка окружения
```bash
cd backend
npm install
```

Создайте `.env` в корне `backend/`:
```env
PORT=3000
NODE_ENV=development
APP_TIMEZONE=Asia/Yekaterinburg
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=super-secret-jwt-key-change-in-production

# PostgreSQL с PostGIS
DATABASE_URL=postgres://postgres:password@localhost:5432/taksi

# Яндекс Карты API (Геокодер, Suggest, Places, Router)
YANDEX_MAPS_API_KEY=your_yandex_maps_key
YANDEX_SUGGEST_API_KEY=your_yandex_suggest_key
YANDEX_PLACES_API_KEY=your_yandex_places_key
YANDEX_ROUTER_API_KEY=your_yandex_router_key

# GigaChat API (Сбер)
GIGACHAT_AUTH_DATA=your_gigachat_auth_data
GIGACHAT_MODEL=GigaChat-Pro
```

> [!TIP]
> При отсутствии внешних ключей API сервис работает в резервном режиме: геокодирование использует встроенный словарь УрФУ и кэш БД, а расстояние вычисляется по сфере (`ST_DistanceSphere`).

### 2. Миграции, запуск и тестирование
```bash
# Применить миграции БД (PostGIS, типы, таблицы, индексы GIST)
npm run migrate

# Запустить сервер API (http://localhost:3000)
npm start

# Запустить 9 сквозных smoke-тестов
npm test
```

---

## 🧭 Ключевая бизнес-логика

1. **Гео-поиск (PostGIS):** Поиск маршрутов через `ST_DWithin(start_point::geography, ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, radius)` с радиусом по умолчанию 1 000 м и поддержкой текстовых ориентиров УрФУ.
2. **Прозрачный тариф:** Фиксированная стоимость места (`base_price`) без Split Fare. Базовый тариф — **6 ₽/км**, утренний (`07:30–09:30`) и вечерний (`17:00–19:00`) часы пик с коэффициентом **x1.3**.
3. **Гараж автомобилей:** Вместимость от 1 до 8 мест (`seats`). Публикация поездок без добавленного в гараж автомобиля аппаратно заблокирована.
4. **Типы поездок:** Одноразовые (`one_off`) на конкретное время и регулярные (`regular`) с днями недели (`regular_days`) и выбором дня пассажиром (`selected_day`).
5. **Безопасность бронирования:** Атомарные SQL-транзакции с блокировкой строк `SELECT available_seats FROM rides WHERE id = $1 FOR UPDATE` для защиты от овербукинга.

---

## 📡 Спецификация REST API

| Метод | Эндпоинт | Описание | Доступ |
|---|---|---|---|
| `GET` | `/api/health` | Проверка статуса сервера и соединения с PostgreSQL/PostGIS | Публичный |
| `GET` | `/api/suggest` | Подсказки адресов Екатеринбурга (Yandex Suggest + кэш) | Публичный |
| `POST` | `/api/auth/register` | Регистрация (`username`, `password` ≥ 8 симв, `phone` — обязателен) | Публичный |
| `POST` | `/api/auth/login` | Авторизация и получение JWT-токена | Публичный |
| `GET` | `/api/auth/me` | Профиль пользователя (рейтинг, контакты, привязанные авто) | Bearer JWT |
| `PATCH` | `/api/auth/me` | Обновление контактов (`phone`, `telegram`, `first_name`) | Bearer JWT |
| `POST` | `/api/auth/me/avatar` | Загрузка аватара (multipart/form-data, до 5 МБ, magic bytes) | Bearer JWT |
| `GET` | `/api/vehicles` | Список автомобилей водителя в гараже | Bearer JWT |
| `POST` | `/api/vehicles` | Добавление автомобиля (`brand`, `color`, `license_plate`, `seats`) | Bearer JWT |
| `PATCH` | `/api/vehicles/:id` | Редактирование параметров автомобиля | Bearer JWT |
| `GET` | `/api/rides` | Поиск поездок (`start_lat`, `start_lon`, `end_lat`, `end_lon`, `radius`, `time`) | Публичный |
| `POST` | `/api/rides` | Создание поездки водителем (требуется `vehicle_id`) | Bearer JWT |
| `PATCH` | `/api/rides/:id` | Редактирование маршрута/параметров активной поездки | Bearer JWT |
| `POST` | `/api/rides/:id/join` | Бронирование места (`selected_day` для регулярных) | Bearer JWT |
| `POST` | `/api/rides/:id/leave` | Отмена участия в поездке с возвратом места в пул | Bearer JWT |
| `DELETE`| `/api/rides/:id/passengers/:passengerId` | Исключение пассажира водителем | Bearer JWT |
| `GET` | `/api/reviews` | Список отзывов (фильтрация по `user_id`, `ride_id`) | Публичный |
| `POST` | `/api/reviews` | Оценка (1–5 звезд) и отзыв с автопересчетом рейтинга в БД | Bearer JWT |
| `GET` | `/api/admin/stats` | Агрегированная статистика сервиса | Bearer Admin |
| `GET` | `/api/admin/users` | Список всех пользователей с фильтрацией | Bearer Admin |
| `POST` | `/api/admin/block` | Блокировка и разблокировка учетной записи | Bearer Admin |

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
