@echo off
chcp 65001 >nul
echo Запуск Backend-сервера...
start cmd /k "cd backend && npm start"

echo Запуск Frontend-сервера...
start cmd /k "cd frontend && npm run dev -- --host"

echo =======================================================
echo Запуск туннеля в интернет (Pinggy)...
echo На экране появится QR-код и HTTPS-ссылка.
echo Если консоль спросит "Are you sure you want to continue connecting (yes/no)?",
echo введите yes и нажмите Enter.
echo =======================================================
cmd /k "ssh -p 443 -R0:localhost:5173 a.pinggy.io"