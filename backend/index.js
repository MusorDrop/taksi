require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
// Защита HTTP-заголовков с помощью Helmet
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5173' }));
// Ограничение размера JSON тела запроса во избежание DoS-атак
app.use(express.json({ limit: '16kb' }));

// Роуты API
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');

// Базовый роут проверки здоровья сервера
app.get('/api/health', async (req, res) => {
    try {
        const dbRes = await pool.query('SELECT NOW()');
        res.json({ status: 'ok', time: dbRes.rows[0].now, message: 'Сервер работает, БД подключена!' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Ошибка подключения к БД' });
    }
});

// Подключение роутов
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
