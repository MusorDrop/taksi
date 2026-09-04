# Попутка ИИ — Backend (Серверная часть)

Здесь находится серверная часть проекта (API).

## Стек
- **Node.js** + **Express.js**
- **База данных:** PostgreSQL + PostGIS

## Запуск для разработки
1. Установите зависимости:
   ```cmd
   npm install
   ```
2. Запустите сервер:
   ```cmd
   node index.js
   ```

*Сервер будет слушать порт 3000.*

## Конфигурация (Скоро)
В будущем здесь появится файл `.env` для подключения к базе данных.

## Схема базы данных

```mermaid
erDiagram
    USERS ||--o{ VEHICLES : owns
    USERS ||--o{ RIDES : "drives"
    USERS ||--o{ RIDE_REQUESTS : "requests"
    USERS ||--o{ REVIEWS : "writes/receives"
    RIDES ||--o{ MATCHES : "contains"
    RIDE_REQUESTS ||--o| MATCHES : "fulfilled_by"
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

    RIDE_REQUESTS {
        uuid id PK
        uuid passenger_id FK
        geometry start_point "PostGIS Point (4326) - Откуда"
        geometry end_point "PostGIS Point (4326) - Куда"
        timestamp desired_time "Желаемое время"
        int time_window_minutes "Окно гибкости (напр. ±15 мин)"
        enum status "pending, matched, cancelled"
        timestamp created_at
    }

    MATCHES {
        uuid id PK
        uuid ride_id FK
        uuid passenger_id FK
        uuid request_id FK
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
