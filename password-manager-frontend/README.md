# Frontend

Next.js App Router, React and Tailwind. Use Node 24 or 22.18+.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Configure NEXT_PUBLIC_API_URL before building. Use the same localhost spelling
for frontend/backend during local development. The API helper includes credentials
and CSRF headers; it never reads authentication cookies or JWTs.

```sh
npm test
npm run lint
npm run build
npm audit
```

The Vercel root is `password-manager-frontend`. See the root
[deployment guide](../docs/DEPLOYMENT.md) for cross-site preview cookies and final
custom-domain settings. The camera component captures images; face detection and
comparison run on the server. Client face-api.js models/CDN loading are unnecessary
and no longer used. Enrollment requires email verification on the backend.
