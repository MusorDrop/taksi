<div align="center">

# 🚕 Попутка ИИ (УрФУ Карпулинг)

### Умный сервис совместных поездок для студентов и преподавателей УрФУ
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

**«Попутка ИИ»** — это сервис, который помогает студентам УрФУ быстро, дешево и с комфортом добираться до университета. Сервис связывает исторические корпуса в центре Екатеринбурга с удаленным кампусом в Новокольцовском районе.

Вместо того чтобы ждать переполненный автобус или платить огромные деньги за коммерческое такси, студенты могут кооперироваться с однокурсниками, у которых есть машины. Водитель экономит на бензине, а пассажир доезжает с комфортом и в хорошей компании!

### ⚖️ Сравнение вариантов поездки

| Критерий | 🚌 Автобусы | 🚕 Коммерческое такси | 🚗 Попутка ИИ (УрФУ) |
| :--- | :---: | :---: | :---: |
| **Время в пути** | 60–90 мин (с пересадками) | 25–40 мин | **20–35 мин (прямой маршрут)** |
| **Средняя стоимость** | ~35–70 ₽ | 450–900 ₽ | **70–150 ₽ (компенсация бензина)** |
| **Комфорт** | Переполненный салон | Индивидуально | **Гарантированное сидячее место** |
| **Окружение** | Случайные пассажиры | Незнакомый водитель | **Студенческое комьюнити** |
| **Поиск поездки** | Расписание на остановках | Долгое ожидание | **Умный поиск с ИИ (напиши текстом)** |

---

## 🌟 Главные фишки проекта

| Функция | Описание и технические детали |
| :--- | :--- |
| 🗺️ **Интеграция Яндекс Карт** | Интерактивные карты с отрисовкой маршрутов по реальным дорогам. Помогают водителю и пассажиру точно понять, где они встретятся. |
| 🤖 **Умный поиск (GigaChat)** | Пассажиру не нужно заполнять десятки фильтров. Нейросеть понимает студенческий сленг (например, *«Завтра от ГУКа в Новокольцово к 8:30»*) и сама находит подходящую машину. |
| 📍 **Поиск попутчиков по пути** | Система сама анализирует маршруты и предлагает водителям пассажиров, которых удобно забрать по дороге, не делая больших крюков (используется технология PostGIS). |
| 🛡️ **Гарантия места (Защита от сбоев)** | Наш сервер надежно защищает поездки от двойных бронирований. Два человека физически не смогут занять одно и то же последнее место в машине. |
| 🔐 **Безопасность и Админка** | Регистрация защищена паролями. Есть панель администратора для модерации поездок и защита сервера от атак и перегрузок. |
| 📱 **Установка без AppStore (PWA)** | Сервис работает прямо в браузере, но его можно в один клик установить на экран телефона. Он выглядит и работает как полноценное приложение. |
| 🔁 **Регулярные поездки** | Водитель может настроить расписание один раз (например, "каждую среду к 8:30"), и система сама будет собирать попутчиков на нужный день недели. |
| ⭐ **Система отзывов** | После поездки участники оценивают друг друга (от 1 до 5 звезд). Это формирует безопасное студенческое сообщество. |

## 🛠 Технологический стек

### 💻 Внешний вид (Frontend)
| Технология | Назначение | Бейдж |
| :--- | :--- | :--- |
| **React 19** | Создание красивого и быстрого интерфейса | ![React](https://img.shields.io/badge/React-19.2-20232A?logo=react&logoColor=61DAFB) |
| **Vite 8** | Высокоскоростной запуск и сборка проекта | ![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white) |
| **MUI v7** | Готовые элементы дизайна (кнопки, карточки) | ![MUI](https://img.shields.io/badge/MUI-v7.3-007FFF?logo=mui&logoColor=white) |
| **TypeScript 5.9** | Защита от ошибок в коде на этапе написания | ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white) |

### ⚙️ Мозг и База данных (Backend)
| Технология | Назначение | Бейдж |
| :--- | :--- | :--- |
| **Node.js 20+** | Сердце проекта, обрабатывающее все запросы | ![NodeJS](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white) |
| **Express 5** | Удобный каркас для создания серверной логики | ![Express](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white) |
| **PostgreSQL 15+** | Надежная база данных для хранения профилей и поездок | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white) |
| **PostGIS 3.6** | Умный модуль для работы с гео-координатами и картами | ![PostGIS](https://img.shields.io/badge/PostGIS-3.6-2D725C?logo=postgis&logoColor=white) |

### 🌐 Внешние интеграции и ИИ
| Сервис / API | Назначение | Бейдж |
| :--- | :--- | :--- |
| **Yandex Maps API** | Отрисовка интерактивной карты и маршрутов | ![Yandex](https://img.shields.io/badge/Yandex-Maps_API_2.1-red?logo=yandex&logoColor=white) |
| **GigaChat-Pro** | Нейросеть от Сбера для понимания текста студентов | ![GigaChat](https://img.shields.io/badge/Sber-GigaChat_Pro-107C41?logo=sberbank&logoColor=white) |

---

## 🏛 Архитектура решения

```mermaid
graph TD
    User["Студент / Преподаватель (Браузер или Телефон)"]
    
    subgraph FrontendApp ["Внешний интерфейс (Frontend)"]
    UI["Сайт на React"]
    MapClient["Яндекс Карты (визуализация)"]
    end

    subgraph BackendApp ["Сервер (Backend)"]
    Gateway["Обработчик запросов (Express)"]
    AuthMiddleware["Проверка безопасности и паролей"]
    RouteController["Логика поездок и бронирований"]
    AIController["Связь с нейросетью"]
    end

    subgraph DatabaseLayer ["Хранилище данных"]
    PG[("База данных PostgreSQL")]
    GIS[("Модуль карт PostGIS")]
    end

    subgraph ExternalCloud ["Внешние сервисы"]
    YandexCloud["Серверы Яндекса (маршруты)"]
    GigaChatCloud["Серверы Сбера (GigaChat)"]
    end

    User --> UI
    UI --> MapClient
    UI -->|Защищенный запрос| Gateway

    Gateway --> AuthMiddleware
    AuthMiddleware --> RouteController
    AuthMiddleware --> AIController

    RouteController -->|"Надежное бронирование места"| PG
    RouteController -->|"Поиск машин рядом"| GIS

    RouteController -->|Запрос карты| YandexCloud
    AIController -->|Текст от студента| GigaChatCloud
```

---

## 🚀 Быстрый старт (Для разработчиков)

### 1️⃣ Настройка и запуск сервера (Backend)

```bash
# Перейдите в директорию бэкенда
cd backend

# Установите зависимости
npm install

# Примените структуру базы данных:
npm run migrate

# Запустите сервер (по умолчанию порт 3000):
npm start
```

### 2️⃣ Настройка и запуск клиента (Frontend)

В отдельном терминале выполните:

```bash
# Перейдите в директорию фронтенда
cd frontend

# Установите зависимости
npm install

# Запустите сайт для разработчиков:
npm run dev
```

Откройте веб-приложение в браузере: **`http://localhost:5173`**

---

<div align="center">
  <sub>Разработано командой MusorDrop с ❤️ для студентов и преподавателей УрФУ</sub>
</div>
