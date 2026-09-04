---
trigger: always_on
---
# Core Engineering Rules
1. Early Returns: Keep execution paths flat. Exit early on error or boundary conditions.
2. Single Responsibility: Functions must not exceed 30-40 lines. Split complex tasks into modular helpers.
3. Strict Typing: Explicit interfaces, types, and DTOs. Zero usage of `any`.
4. Production Quality: No `// TODO`, mock data in production paths, or unfinished logic.
5. Russian Comments: All code comments, docstrings, and technical explanations must be in Russian.
