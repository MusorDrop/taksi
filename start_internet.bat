@echo off
chcp 65001 >nul
echo Запуск Backend-сервера...
start cmd /k "cd backend && npm start"

echo Запуск Frontend-сервера...
start cmd /k "cd frontend && npm run dev -- --host"

echo =======================================================
echo Запуск туннеля в интернет (Localtunnel)...
echo Пожалуйста, подождите пару секунд, пока сгенерируется публичная ссылка!
echo Скопируйте ссылку, которая появится ниже (начинается с https://).
echo.
echo ВАЖНО: При переходе с телефона вас может попросить
echo нажать синюю кнопку "Click to Continue", чтобы подтвердить вход.
echo =======================================================
cmd /k "npx localtunnel --port 5173 --local-https --allow-invalid-cert"