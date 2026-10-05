# HTTP API (Community Board, contact, ratings, admin)

All endpoints are Next.js route handlers under `src/app/api/**/route.ts` (Node runtime).
Bodies are JSON. Every write endpoint: Zod validation → honeypot check → per-IP rate limit
→ `sanitize-html` (no tags allowed) on all text → insert. Errors use
`{ error: string, fieldErrors?: Record<string, string> }`.

Typed client helpers for the UI live in `src/lib/api-client.ts`.

## Types

```ts
type PostType = 'feature' | 'bug' | 'game' | 'general';
// UI labels: Feature request · Bug · Game request · General feedback
type PostStatus = 'open' | 'planned' | 'in-progress' | 'done';

interface Post {
  id: number; type: PostType; title: string; body: string;
  authorName: string | null;      // never expose authorEmail publicly
  status: PostStatus; upvotes: number; commentCount: number;
  createdAt: string;              // ISO
  hasVoted?: boolean;             // when ?voter=<token> is supplied
}
interface Comment { id: number; postId: number; body: string; authorName: string | null; createdAt: string }
```

## Limits

| Field | Rule |
| --- | --- |
| post.title | 3–120 chars |
| post.body | 10–2000 chars |
| name | optional, ≤ 60 chars |
| email | optional (required for contact), valid email, ≤ 120 chars |
| comment.body | 2–1000 chars |
| contact.message | 10–3000 chars |
| rating.stars | integer 1–5; rating.comment optional ≤ 500; rating.gameSlug must be a known slug format `^[a-z0-9-]{2,40}$` |
| voterToken | 8–100 chars `[A-Za-z0-9-_]` |
| `website` | honeypot — must be empty/absent; if filled → `201`-shaped fake success, nothing stored |

Rate limit: `RATE_LIMIT_PER_MINUTE` (default 8) writes per IP per minute across posts,
comments, contact and ratings; votes have a separate limit of 60/min. Exceeding → `429`
`{ error: 'Too many requests — take a breather and try again in a minute.' }`.

Other status codes: `415` when the body is not `application/json`, `413` for bodies over
32 KB, `403` for cross-site admin mutations/login/logout (Origin / `Sec-Fetch-Site` check),
`404` for malformed or unknown ids. Every response sends `cache-control: no-store`.
Failed admin logins are limited to 10 per minute per IP.

## Public endpoints

| Method & path | Body / query | Success |
| --- | --- | --- |
| `GET /api/posts` | `?sort=new\|top&type=<PostType>&voter=<token>` | `200 { posts: Post[] }` (max 100) |
| `POST /api/posts` | `{ type, title, body, name?, email?, website? }` | `201 { post: Post }` |
| `GET /api/posts/:id` | `?voter=<token>` | `200 { post: Post, comments: Comment[] }` · `404` |
| `POST /api/posts/:id/vote` | `{ voterToken }` | `200 { upvotes: number, hasVoted: boolean }` (toggles) |
| `POST /api/posts/:id/comments` | `{ body, name?, website? }` | `201 { comment: Comment }` |
| `POST /api/contact` | `{ name, email, message, website? }` | `201 { ok: true }` |
| `POST /api/ratings` | `{ gameSlug, stars, comment?, website? }` | `201 { ok: true }` |

## Admin endpoints

Admin is enabled only when `ADMIN_PASSWORD` is set (otherwise `503`). Session cookie
`goc_admin` (httpOnly, SameSite=Strict, Secure in production, 8 h, HMAC-signed).
Unauthenticated → `401`.

| Method & path | Body | Success |
| --- | --- | --- |
| `POST /api/admin/login` | `{ password }` | `200 { ok: true }` + cookie · `401` wrong password |
| `POST /api/admin/logout` | — | `200 { ok: true }` (clears cookie) |
| `GET /api/admin/session` | — | `200 { authenticated: boolean, enabled: boolean }` |
| `GET /api/admin/overview` | — | `200 { posts: (Post & { authorEmail })[], comments: (Comment & { postTitle })[], messages: ContactMessage[], ratings: Rating[], ratingSummary: { gameSlug, count, average }[] }` |
| `PATCH /api/admin/posts/:id` | `{ status: PostStatus }` | `200 { post }` |
| `DELETE /api/admin/posts/:id` | — | `200 { ok: true }` (cascades comments & votes) |
| `DELETE /api/admin/comments/:id` | — | `200 { ok: true }` |
| `PATCH /api/admin/messages/:id` | `{ read: boolean }` | `200 { ok: true }` |
| `DELETE /api/admin/messages/:id` | — | `200 { ok: true }` |

```ts
interface ContactMessage { id: number; name: string; email: string; message: string; read: boolean; createdAt: string }
interface Rating { id: number; gameSlug: string; stars: number; comment: string | null; createdAt: string }
```
