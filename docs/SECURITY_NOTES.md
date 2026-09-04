# Security Notes

- Passwords and verifier values are deployment or local secrets and are not committed.
- New verifier generation uses PBKDF2-SHA256.
- The deployed demo retains a narrow compatibility path for an existing disposable Planner verifier.
- Tool visibility is not authorization: every request is authenticated and authorized on the server.
- The write route accepts only the canonical Seat, Branch, target, stamp, and scope for the submission flow.
- Writes require the current Branch Version and a request ID.
- Duplicate request IDs return the stored result rather than creating a second mutation.
- Session cookies are opaque, HttpOnly, SameSite=Lax, and Secure on HTTPS.
- Public repository scans exclude passwords, verifier material, cookies, tokens, and private deployment identifiers.
