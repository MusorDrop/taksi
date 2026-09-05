const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

// Базовый маршрут
app.get('/', (req, res) => {
  res.send('API Попутка ИИ работает! (Express.js)');
});

app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
