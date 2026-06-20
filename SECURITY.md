# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in airgap, please report it privately.

**Do not** report security vulnerabilities through public GitHub issues.

Instead, send an email to [hasitp.bhatt@gmail.com](mailto:hasitp.bhatt@gmail.com) with:

- A description of the vulnerability
- Steps to reproduce the issue
- Affected versions
- Any potential impact

You should receive a response within 48 hours. If you don't, please follow up.

## Scope

This security policy covers:

- **API key handling** — keys are stored in localStorage and never transmitted outside the configured LLM API endpoint
- **XSS via chat rendering** — user/AI messages are rendered as sanitized HTML; marked.js and Prism.js may introduce rendering vectors
- **localStorage encryption** — data is stored in plaintext (no at-rest encryption)
- **Fetch proxy** — the Cloudflare Worker (`worker.js`) proxies web requests; injection or SSRF via the proxy

## Supported versions

| Version | Supported |
|---------|-----------|
| latest  | ✅        |

## Timeline

We aim to:

1. **Acknowledge** receipt within 48 hours
2. **Investigate** and develop a fix within 7 days
3. **Release** a fix within 14 days of confirmation
4. **Disclose** publicly 30 days after the fix is released (or sooner if a bypass is discovered)

## Security considerations

- airgap runs entirely in the browser. All security guarantees are subject to the browser's same-origin policy.
- The fetch proxy (Cloudflare Worker) sees only the URLs you pass to it — it does not have access to your API key.
- Conversations and memory are stored in plaintext in localStorage. Do not store sensitive secrets in chat messages.
- Clearing browser data removes all stored information.