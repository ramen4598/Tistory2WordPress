# 009-axios-hang-out — Analysis

## Problem

During long-running migrations, WordPress REST calls occasionally fail with Node.js network errors like `socket hang up`.

## Observations (current code)

- WP REST API is called via a single axios instance created in `createWpClient()` (`src/services/wpClient.ts`).
- That WP client is created once per run (via `createMigrator()` in `src/workers/postProcessor.ts`).
- Default Node.js agent behavior can lead to suboptimal connection reuse (no explicit keep-alive configuration).

## Working hypothesis

`socket hang up` is commonly caused by:

- Stale/idle TCP connections being closed by the server/proxy/load balancer.
- Connection churn and lack of predictable pooling behavior.

Even with long request timeouts, server-side idle timeouts can still close sockets unexpectedly.

## Decision

Improve HTTP connection reuse by:

- Enabling `keepAlive` via a dedicated `https.Agent`.
- Keeping warm idle sockets up to `workerCount` using `maxFreeSockets`.
- Keeping per-request timeout at 10 minutes (do not reduce).

## Non-decision / Explicitly avoided

- Introducing `RATE_LIMIT_MAX_CONNECTION` / `maxSockets` tuning at the agent level, because concurrency is already controlled by worker count and `p-queue`.

## Expected outcomes

- Reduced frequency of `socket hang up` during long runs.
- More stable and predictable connection reuse.
