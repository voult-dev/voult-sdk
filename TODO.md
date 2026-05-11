# TODO

- [ ] Inspect existing token/session persistence utilities (e.g. server-side `persistVoultAuth`) to understand how `accessToken`/`refreshToken` are stored and reused.
- [x] Implement SDK refresh logic in `src/client.js`: add `refreshSession()` and retry-once for 401.
- [ ] Fix potential SDK refresh retry loop/hang by isolating refresh call from interceptor.


- [ ] Ensure `refreshSession()` correctly sends refresh token and uses required headers (client secret if needed).
- [ ] Update `src/client.js` request interceptor / error handler to refresh and retry only once to avoid loops.
- [ ] Run a quick smoke test (sign-in -> wait ~2-3 minutes -> call an auth-required endpoint like `getCurrentUser`).