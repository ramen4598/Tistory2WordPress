# 009-axios-hang-out — Plan

## Goal

Reduce/mitigate long-running migration failures showing up as Node.js/axios `socket hang up` by improving HTTP connection management for WordPress REST requests.

The agreed approach:

- Configure an `https.Agent` with `keepAlive: true` on the shared WordPress axios instance.
- Do **not** introduce a separate `RATE_LIMIT_MAX_CONNECTION` setting (to avoid fighting `workerCount` + `p-queue` concurrency controls).
- Keep the long per-request timeout (10 minutes) but apply it **per request** (e.g., per `client.post()`), not as a global axios instance timeout.
- Align `maxFreeSockets` to worker concurrency so we keep warm sockets up to the worker count.

## Scope

### In-scope code changes

- `src/services/wpClient.ts`
  - Add `https.Agent` creation and pass it via `httpsAgent`.
  - Set `maxFreeSockets` to `config.workerCount` (worker count 만큼 유휴 연결 유지).
  - Keep `keepAliveMsecs` at 60s.
  - Apply `{ timeout: 600000 }` on each WP REST request (create post, upload, deletes, taxonomy list/create).

### In-scope docs/spec changes

- `specs/009-axios-hang-out/`
  - Add analysis, plan, tasks, quickstart notes.
- Optionally augment project docs (if necessary for user-facing clarity):
  - `docs/spec.md` (short note: WP REST uses keep-alive agent; long request timeout remains 10m).

## Non-goals

- Changing overall migration concurrency logic (`p-queue` worker/rate limits).
- Reducing 10 minute request timeout.
- Introducing new env vars for sockets/connections.

## Implementation Notes

### Agent lifecycle

- The WP axios instance is created once per process (within `createMigrator()` created once inside `createPostProcessor()`), so the agent is also a singleton per run.

### Why `maxFreeSockets: workerCount`

- Keeps up to workerCount idle sockets ready for reuse.
- Avoids introducing `maxSockets` throttling which could conflict with worker-level throttling.

### Timeout handling

- Keep global axios instance config minimal.
- Add per-request timeouts to ensure consistency and to allow future per-operation tuning.

## Verification

- Unit tests should confirm:
  - `axios.create()` is called with an `httpsAgent` configured with `keepAlive: true`.
  - Requests include `{ timeout: 600000 }` where applicable.
- Run existing unit tests.
