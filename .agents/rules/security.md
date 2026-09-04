---
trigger: always_on
---
# Security & Secret Protection
1. Secrets: Zero hardcoded keys, tokens, passwords, or connection strings. Use `.env`.
2. Input Sanitization: Validate all external inputs with schema validators (Zod, Pydantic).
3. Database Queries: Always use parameterized queries or ORM builders to prevent SQL injections.
