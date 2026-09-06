@echo off
echo Запуск бэкенда (Node.js)...
start cmd /k "cd backend && npm run start"


echo Запуск фронтенда (Vite)...
start cmd /k "cd frontend && npm run dev"

echo Серверы запущены!
