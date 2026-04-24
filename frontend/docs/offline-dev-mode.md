# Frontend Offline and Dev Mode

This note documents how the dashboard behaves when backend analysis is unavailable and how contributors should develop safely in local/offline workflows.

## Scope and owner files

- Analyze API route: `frontend/app/api/analyze/route.ts`
- Dashboard upload/parse flow: `frontend/app/dashboard/page.tsx`
- Upload controls: `frontend/app/components/DashboardHeader.tsx`

## Operational modes

### Local JSON-only mode (offline-safe)

- Users can still work fully from local JSON reports without calling backend analysis.
- Uploading or pasting JSON works without the `sanctifier` binary.
- This mode is ideal for UI iteration, triage review, and reproducible demos.

### Contract upload mode (requires local tooling)

- Contract upload posts source to `/api/analyze`.
- The route executes `sanctifier analyze --format json` using:
  - `SANCTIFIER_BIN` if set
  - `sanctifier` in PATH otherwise
- Missing binary, timeout, invalid content type, unsupported extension, invalid UTF-8, and oversized payloads return explicit API errors.

## Dev guardrails

- Keep JSON parsing (`parseReport`) independent from runtime analysis so UI workflows remain available during backend outages.
- Preserve input limits and extension checks in the API route.
- Keep error strings user-readable because they are surfaced directly in the dashboard.
- If adding new dev flags or env vars, document defaults and fallback behavior in this file.
