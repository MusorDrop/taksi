# Project Constitution: Попутка ИИ (Студенческий райдшеринг)

> [!NOTE]
> Локальная конституция проекта для агентов Google Antigravity.
> Этот файл содержит фундаментальные правила, технологический стек и процессы проверки для данного проекта. Любой агент, начинающий работу в этом репозитории, должен понимать контекст проекта и строго следовать этим указаниям.

## 1. Technology Stack & Runtime
- **Architecture:** Monorepo (`/backend` and `/frontend`).
- **Runtime / Language:** Node.js (v20+) / JavaScript (Backend), TypeScript (Frontend).
- **Backend Framework:** Express.js.
- **Frontend Framework:** React + Vite.
- **Database:** PostgreSQL + PostGIS (обязательно для работы с гео-данными и координатным поиском маршрутов).
- **AI / LLM:** Интеграция с языковыми моделями по API для «умного матчинга» поездок (выбор провайдера в процессе).

## 2. Verification Commands (Strict Feedback Loop)
Before declaring ANY task complete, the agent MUST run these commands via `run_command` in the appropriate directories and fix all warnings/errors:
- **Frontend Check:** `npm run lint` and `npm run build` in `/frontend`.
- **Backend Check:** `node index.js` (or `npm run start`) in `/backend` to ensure the server starts without crashing.

## 3. Autonomous Execution Rules
- **Autonomy:** Proceed autonomously without asking for confirmation when reading files, editing source code, running builds, running tests, or installing local dependencies.
- **Confirmation Gate:** Stop and ask via `ask_question` ONLY for destructive actions: `DROP TABLE`, `TRUNCATE`, `git reset --hard`, `git push --force`, or recursive directory deletion outside `scratch/`.

## 4. Coding & Architecture Standards
- **Separation of Concerns:** Backend code strictly stays in `/backend`. Frontend code strictly stays in `/frontend`. NEVER mix logic or global configs.
- **Git Flow:** Feature branches (like `feat/backend`) must merge into `dev`. `main` is strictly for production.
- **Flat Architecture:** ALWAYS use early returns. Maximum nesting depth <= 3.
- **No Placeholders:** Never output `// TODO` or mockup stubs. Deliver production-ready code.
- **Language Rules:** All code symbols (variables, classes, functions) MUST be in English. All inline comments, docstrings, and technical explanations MUST be in Russian.
