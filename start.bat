@echo off
chcp 65001 >nul
echo Запуск Backend-сервера...
start cmd /k "cd backend && npm start"

echo Запуск Frontend-сервера...
start cmd /k "cd frontend && npm run dev"

echo Проект "Попутка ИИ" запускается в двух новых окнах!
