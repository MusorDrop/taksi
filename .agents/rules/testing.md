---
trigger: model_decision
---
# Testing Standards
1. Test-Driven Verification: Every new endpoint or business logic unit must have automated unit tests.
2. Framework: Use the repository's native test runner (Vitest, Jest, Pytest).
3. Edge Cases: Test happy paths, boundary conditions (null, empty arrays, limits), and error paths.
4. Mocks: Never mock system-under-test. Mock only external I/O (network, third-party APIs).
