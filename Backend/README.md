# HR System API

Express and MongoDB API for HR authentication and future protected HR modules.

## Local setup

1. Copy `.env.example` to `.env` and replace `JWT_SECRET` with a strong random value.
2. Ensure MongoDB is running.
3. Install dependencies with `npm install`.
4. Start the API with `npm run dev`.

The versioned API is served at `http://localhost:4000/api/v1`. Authentication routes are:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /health`

Successful login and registration set a signed JWT in an `HttpOnly` cookie. Session records are persisted in MongoDB and checked on every authenticated request. Logout revokes the persisted session.
