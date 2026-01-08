# 009-axios-hang-out — Quickstart

## What changed

- WordPress REST axios client now uses a keep-alive `https.Agent`.
- WordPress REST requests explicitly set a 10 minute per-request timeout.

## How to verify

1. Run a small migration (few posts) and confirm no regressions.
2. Run a longer migration. If `socket hang up` happens, inspect logs around WP REST calls.

## Useful checks

- Confirm the worker concurrency is set appropriately via `.env` (`WORKER_COUNT`).
- If the server has strict keep-alive settings, consider tuning `keepAliveMsecs` later.
