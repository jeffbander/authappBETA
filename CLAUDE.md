# CLAUDE.md

## Rules

- Always execute tasks yourself rather than telling the user to do them. If you can run a command, run it. If you can make an edit, make it.
- Always test changes after making them (e.g. `npx convex dev --once` for schema/function changes, build commands, lint, etc.).
- If tests or builds fail, fix the errors yourself and re-run until they pass. Do not leave broken code for the user to fix.
- This is a security-sensitive healthcare application. Avoid common security issues: no SQL/NoSQL injection, no XSS, no command injection, no hardcoded secrets, no exposing sensitive patient data in logs or client-side code. Validate and sanitize all user input. Follow OWASP top 10 guidelines.
