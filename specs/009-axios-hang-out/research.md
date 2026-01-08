# 009-axios-hang-out — Research

## Node.js / axios connection management

- In Node.js, keep-alive is configured on `http.Agent` / `https.Agent` and passed to axios via `httpAgent` / `httpsAgent`.
- axios instance 자체는 keep-alive 설정을 가지지 않고, agent가 연결 재사용을 담당한다.

## Key knobs

- `keepAlive`: reuse TCP sockets.
- `keepAliveMsecs`: keep-alive probes/idle socket keep duration hint.
- `maxFreeSockets`: how many idle sockets to keep around.

## Repo constraints

- Migration concurrency is governed by `WORKER_COUNT` and `p-queue`.
- Avoid introducing separate socket concurrency knobs that can conflict with worker concurrency.
