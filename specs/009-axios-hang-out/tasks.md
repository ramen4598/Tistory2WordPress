# 009-axios-hang-out — Tasks

## T-1 Update WP axios client to use keep-alive agent

- [ ] Edit `src/services/wpClient.ts` to import `https` and configure `https.Agent`.
- [ ] Set `httpsAgent` on axios instance:
  - `keepAlive: true`
  - `keepAliveMsecs: 60000`
  - `maxFreeSockets: config.workerCount`
  - `rejectUnauthorized: true`

## T-2 Apply per-request timeout (10 minutes)

- [ ] Ensure WP REST calls in `src/services/wpClient.ts` pass `{ timeout: 600000 }` as request config.
  - `POST /posts`
  - `POST /media`
  - `DELETE /media/:id`
  - `DELETE /posts/:id`
  - `GET /categories` (paged search)
  - `POST /categories`
  - `GET /tags` (paged search)
  - `POST /tags`

## T-3 Update / add unit tests

- [ ] Update `tests/unit/services/wpClient.test.ts` expectations for `axios.create()` to include `httpsAgent`.
- [ ] Add/adjust assertions that request calls include `timeout: 600000`.

## T-4 Documentation

- [ ] Add `specs/009-axios-hang-out/analysis.md` with problem statement and rationale.
- [ ] Add `specs/009-axios-hang-out/quickstart.md` (how to verify locally; where to check logs).
- [ ] (Optional) Update `docs/spec.md` with a short note about keep-alive usage for WP REST.

## T-5 Verification

- [ ] Run unit tests: `npm test` (or repo’s standard test command).
