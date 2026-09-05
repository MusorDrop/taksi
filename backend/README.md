# Попутка ИИ — Backend (Серверная часть)

Серверная часть платформы совместных поездок (райдшеринг) для студентов УрФУ.

## 🚀 Возможности платформы

В серверной части платформы реализованы инфраструктура, безопасность, ключевая бизнес-логика и алгоритмы пространственного матчинга:

1. **Базовая инфраструктура и база данных**
   - Развернут сервер на **Node.js** + **Express.js**.
   - Спроектирована и настроена реляционная БД **PostgreSQL** с расширением **PostGIS** для гео-пространственных данных (точки маршрутов, полилинии).
   - Подготовлена миграция схемы базы данных (`db/migrations/001_initial_schema.sql`).
   - Настроено подключение к БД через пул соединений (`pg.Pool`) с поддержкой конфигурации через переменные окружения.

2. **Авторизация, поездки и бронирование**
   - **Авторизация и безопасность:**
     - Хеширование паролей с помощью **bcryptjs** (соль 10 раундов).
     - Генерация и валидация токенов **JWT** (JSON Web Token).
     - Регистрация и вход только по уникальному логину (username) без использования электронной почты.
     - Middleware проверки подлинности (`authMiddleware`) для защищенных эндпоинтов.
   - **Поездки (CRUD):**
     - Публикация маршрута водителем (`POST /api/rides`).
     - Получение списка доступных поездок (`GET /api/rides`).
   - **Система бронирования:**
     - Присоединение пассажира к поездке (`POST /api/rides/:id/join`) с атомарным списанием мест.
     - Защита от race conditions через транзакции PostgreSQL (`BEGIN`, `SELECT ... FOR UPDATE`, `COMMIT`).
     - Отмена бронирования (`POST /api/rides/:id/leave`) с возвратом свободного места.

3. **Гео-поиск и динамическое ценообразование (PostGIS-матчинг)**
   - **Гео-пространственный поиск через PostGIS (`ST_DWithin`):**
     - Реализован гео-поиск поездок по координатам точек посадки (`start_lat`, `start_lon`) и/или высадки (`end_lat`, `end_lon`).
     - Фильтрация выполняется в заданном радиусе (`radius`, по умолчанию 1000 метров) с использованием пространственного типа `geography`:
       `ST_DWithin(r.start_point::geography, ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, radius)`.
     - Пассажиры могут гибко находить подходящие попутки по радиусу вокруг места отправления, места прибытия или по обоим критериям одновременно.
   - **Автоматический расчет расстояния маршрута:**
     - Вычисление дистанции между точками отправления и назначения в километрах через PostGIS-функцию `ST_DistanceSphere` с округлением до сотых (`distance_km`).
   - **Динамическое ценообразование:**
     - Базовый тариф: **6 руб/км**.
     - Пиковый коэффициент: **x1.3** в утренние и вечерние часы пик:
       - Утренний пик: **07:30 – 09:30**
       - Вечерний пик: **17:00 – 19:00**
       - Часовой пояс: Екатеринбург (`Asia/Yekaterinburg`, UTC+5).
     - При создании поездки (`POST /api/rides`) без явного указания стоимости цена рассчитывается автоматически:
       `base_price = distance_km * 6 * (is_peak ? 1.3 : 1.0)`.

4. **🛡 Комплексная безопасность**
   - **Helmet:** установка безопасных HTTP-заголовков для защиты от распространенных веб-уязвимостей.
   - **Rate Limiting:** защита от брутфорса и DDoS (`express-rate-limit`) — глобальный лимитер для API и строгий лимитер для эндпоинтов авторизации.
   - **CORS:** гибкая настройка разрешенных источников через переменную `CORS_ORIGIN`.

5. **🧪 Автоматизированные тесты**
   - Написан расширенный набор **smoke-тестов** (`smoke-test.js`), проверяющий:
     - Health-check (`/api/health`).
     - Регистрацию нового пользователя с валидацией пароля (`/api/auth/register`).
     - Аутентификацию (`/api/auth/login`) и выдачу JWT.
     - Защиту приватных маршрутов (проверка ответа 401 при отсутствии токена).
     - Защитные заголовки Helmet и стабильность Rate Limiter.
     - Корректность подключения к PostgreSQL и расширению PostGIS.
     - Автоматический расчет дистанции (`distance_km`) и динамическое ценообразование с учетом часов пик (множитель x1.3, базовый тариф 6 руб/км).
     - Гео-поиск поездок через `ST_DWithin` по заданным координатам и радиусу с проверкой включения и исключения поездок.

---

## 🛠 Стек технологий
- **Среда выполнения:** Node.js (v20+)
- **Фреймворк:** Express.js v5
- **База данных:** PostgreSQL 15+ с расширением PostGIS
- **Безопасность:** JWT, bcryptjs, Helmet, Express Rate Limit, CORS
- **Драйвер БД:** `pg` (node-postgres)

---

## 📡 API Эндпоинты

### Общие
- `GET /api/health` — проверка статуса сервера и подключения к PostgreSQL/PostGIS.

### Авторизация (`/api/auth`)
- `POST /api/auth/register` — регистрация нового пользователя (валидация username, password, first_name, role).
- `POST /api/auth/login` — вход по логину и паролю с возвратом JWT-токена.

### Поездки (`/api/rides`)
- `GET /api/rides` — список доступных поездок со свободными местами с поддержкой гео-фильтрации и фильтра по времени (публичный):
  - **Query-параметры:**
    - `start_lat`, `start_lon` — координаты точки посадки пассажира.
    - `end_lat`, `end_lon` — координаты точки высадки пассажира.
    - `radius` — радиус гео-поиска в метрах (по умолчанию `1000`).
    - `departure_time` (или `time`) — фильтр по времени отправления (по умолчанию `> NOW()`).
  - **Возвращаемые данные:** список поездок с полями `distance_km`, `is_peak`, `base_price`, информацией о водителе и гео-координатами.
- `POST /api/rides` — создание новой поездки (требуется Bearer токен водителя):
  - Принимает координаты или названия известных локаций (`start_point`, `end_point`).
  - Автоматически рассчитывает дистанцию через PostGIS (`ST_DistanceSphere`) и стоимость (базовый тариф 6 руб/км, пиковый множитель x1.3), если `base_price` не передана вручную.
- `POST /api/rides/:id/join` — бронирование места в поездке (требуется Bearer токен пассажира).
- `POST /api/rides/:id/leave` — отмена бронирования (требуется Bearer токен пассажира).

---

## ⚙️ Переменные окружения (.env)

Создайте файл `.env` в папке `backend/`:

```env
PORT=3000
JWT_SECRET=super-secret-key-change-in-production
CORS_ORIGIN=*

# Подключение к PostgreSQL:
DATABASE_URL=postgres://postgres:password@localhost:5432/taksi
# Либо по отдельности:
# PGHOST=localhost
# PGPORT=5432
# PGUSER=postgres
# PGPASSWORD=password
# PGDATABASE=taksi
```

---

## 🚀 Запуск и тестирование

1. **Установка зависимостей:**
   ```cmd
   npm install
   ```

2. **Запуск сервера для разработки:**
   ```cmd
   npm start
   # или node index.js
   ```
   *Сервер будет доступен по адресу `http://localhost:3000`.*

3. **Запуск smoke-тестов:**
   ```cmd
   npm test
   # или npm run test:smoke
   ```

---

## Схема базы данных

```mermaid
erDiagram
    USERS ||--o{ VEHICLES : owns
    USERS ||--o{ RIDES : "drives"
    USERS ||--o{ REVIEWS : "writes/receives"
    RIDES ||--o{ MATCHES : "contains"
    USERS ||--o{ MATCHES : "rides_as_passenger"

    USERS {
        uuid id PK
        varchar username "Уникальный логин для входа"
        varchar password_hash "Хэш пароля"
        varchar first_name "Имя"
        varchar last_name "Фамилия"
        varchar phone "Телефон"
        enum role "driver, passenger, both"
        decimal rating "Рейтинг пользователя"
        boolean is_verified "Флаг верификации"
        varchar emergency_contact "Экстренный контакт"
        jsonb preferences "Предпочтения"
        timestamp created_at
    }

    VEHICLES {
        uuid id PK
        uuid owner_id FK
        varchar make_model "Марка и модель"
        varchar plate_number "Госномер"
        varchar color "Цвет"
        int capacity "Количество пассажирских мест"
    }

    RIDES {
        uuid id PK
        uuid driver_id FK
        uuid vehicle_id FK
        timestamp departure_time "Время старта"
        geometry start_point "PostGIS Point (4326)"
        geometry end_point "PostGIS Point (4326)"
        geometry route_line "PostGIS LineString (4326) - Полный маршрут"
        int total_seats
        int available_seats
        enum status "scheduled, in_progress, completed, cancelled"
        decimal base_price "Базовая цена"
        timestamp created_at
    }

    MATCHES {
        uuid id PK
        uuid ride_id FK
        uuid passenger_id FK
        geometry pickup_point "PostGIS Point (4326) - Точка посадки"
        geometry dropoff_point "PostGIS Point (4326) - Точка высадки"
        decimal agreed_price "Итоговая цена поездки"
        enum status "accepted, completed, cancelled"
        timestamp created_at
    }

    REVIEWS {
        uuid id PK
        uuid ride_id FK
        uuid reviewer_id FK
        uuid reviewee_id FK
        int rating "Оценка от 1 до 5"
        text comment "Отзыв"
        timestamp created_at
    }
```
