require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
// Защита HTTP-заголовков с помощью Helmet с разрешением загрузки ресурсов с разных origins
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5173' }));
// Ограничение размера JSON тела запроса во избежание DoS-атак
app.use(express.json({ limit: '16kb' }));

// Раздача статических файлов (аватарки пользователей) с безопасными параметрами
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    dotfiles: 'ignore',
    index: false
}));

// Роуты API
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Базовый роут проверки здоровья сервера
app.get('/api/health', async (req, res) => {
    try {
        const dbRes = await pool.query('SELECT NOW()');
        res.json({ status: 'ok', time: dbRes.rows[0].now, message: 'Сервер работает, БД подключена!' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Ошибка подключения к БД' });
    }
});

const yandexMaps = require('./services/yandexMaps');

// Получение подсказок адресов через Yandex Suggest API
app.get('/api/suggest', async (req, res) => {
    try {
        const text = req.query.text || req.query.query || '';
        const suggestions = await yandexMaps.suggestAddress(String(text));
        res.json({ suggestions });
    } catch (err) {
        console.warn('Ошибка получения подсказок адресов:', err);
        res.status(500).json({ error: 'Ошибка получения подсказок адресов' });
    }
});

// Подключение роутов
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/admin', adminRoutes);

// Fallback для несуществующих маршрутов (404)
app.use((req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Глобальный обработчик ошибок (500)
app.use((err, req, res, next) => {
    console.error('Необработанная ошибка сервера:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Сервер запущен на порту ${PORT}`);
    });
}

module.exports = app;