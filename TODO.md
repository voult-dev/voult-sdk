# TODO

## Magic link fixes (Voult SDK)
- [x] Step 1: Update `src/auth/signin.js` -> fix `verifyEmailLink` response parsing (handle `response.success` vs `response.data.success`).
- [x] Step 2: Add robust token extraction helper in `src/auth/signin.js` (accept raw token OR callback URL/query/hash; support multiple token key names).

- [x] Step 3: Update `verifyEmailLink` to accept token input flexibly (string token, full URL, or query/hash) using the helper.

- [x] Step 4: Minimal hardening for `signInWithEmailLink` payload/validation (ensure required fields, avoid redundant clientId if risky).
- [x] Step 5: Update `src/index.js` exports to expose any new public helper (without breaking existing API).

- [x] Step 6: Run a quick node import/lint sanity check.



