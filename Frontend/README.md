# HR System

A Next.js client for the HR management system. Authentication and persistence are owned by the separate Express API in `../Backend`.

## Local setup

1. Copy `.env.example` to `.env.local` and configure the API URLs.
2. Start the API from `../Backend`.
3. Start the frontend:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). HR users can register and receive immediate access as defined by the shared source of truth. The API health endpoint is available at `http://localhost:4000/api/v1/health`.

## Shared UI foundations

- Use `ThemeToggle` from `@/components/theme/theme-toggle` anywhere a light/dark switch is needed. Theme state is provided globally and persisted under `hr-theme`.
- Use `alerts` from `@/lib/alerts` in client-side actions:

```tsx
alerts.success("Department created.", {
  title: "Department ready",
  dedupeKey: "department-create",
});
```

- Use `AlertBridge` from `@/components/alerts/alert-bridge` when an existing state message should be presented through the global alert system.
- Use `lucide-react` for interface icons so all current and future modules share one icon language.
