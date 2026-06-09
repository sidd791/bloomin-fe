# Cost Dashboard v2 — Backend Changes Required

> **Audience:** the engineer who owns the BloomBrain FastAPI repo on the data VPS.
> **Status:** the frontend is being redesigned for clarity. Four backend changes are needed — three are small extensions to existing endpoints, one is a new endpoint.
> All changes are under the existing `/cost/...` mount, behind the same JWT auth.

## Important: Table name correction

The sessions table is `user_sessions`, **not** `chat_sessions`. The model is `UserSession` with columns including `id`, `session_key`, `title` (nullable, max 256 chars), `user_id`, `created_at`, `updated_at`. Keep this in mind for all SQL below.

Note: `title` is only set at session creation time and many sessions will have `title = NULL`. The frontend handles the fallback display.

## Context: What already works (DO NOT break these)

The following endpoints are live and the frontend depends on them. Do not change their response shapes — only **extend** them where noted:

| Method | Path | Notes |
|---|---|---|
| GET | `/cost/summary` | Global summary. Keep as-is. |
| GET | `/cost/me/summary` | Self summary. Keep as-is. |
| GET | `/cost/timeseries` | Global timeseries. **Extend** (see §1). |
| GET | `/cost/events` | Global events. **Extend** (see §4). |
| GET | `/cost/me/events` | Self events. Keep as-is. |
| GET | `/cost/users` | User leaderboard. **Extend** (see §2). |
| GET | `/cost/users/{user_id}/summary` | Per-user summary. Keep as-is. |
| GET | `/cost/models` | Pricing table. Keep as-is. |
| GET | `/cost/reconciliation` | Drift check. Keep as-is. |

---

## Change 1: Add `user_id` filter to `/cost/timeseries`

**Current behaviour:** Returns `TimeseriesPoint[]` for all users globally. Accepts `?range=`, `?granularity=`, `?group_by=`.

**Required change:** Accept an optional `?user_id=<UUID>` query parameter. When present, scope the timeseries query to only `cost_events` rows matching that `user_id`.

This lets the frontend render a per-user "spending over time by model" chart on the user detail page (`/cost/users/{id}`).

**Example request:**
```
GET /cost/timeseries?range=7d&granularity=day&group_by=model&user_id=abc-123
```

**Response shape:** Unchanged — same `TimeseriesPoint[]`. Just filtered to that user.

**Auth:** Admin only (same as the existing timeseries endpoint). Return 403 for non-admins.

**Implementation hint:** The existing SQL likely has a `WHERE` clause builder for the filter params — just add:
```python
if user_id:
    conditions.append("ce.user_id = :user_id")
    params["user_id"] = user_id
```

---

## Change 2: Add `search` parameter to `/cost/users`

**Current behaviour:** Returns `UserLeaderboardRow[]` sorted by cost. Accepts `?range=`, filter arrays.

**Required change:** Accept an optional `?search=<string>` query parameter. When present, filter the results to users whose `name` OR `email` contains the search string (case-insensitive `ILIKE`).

This lets the admin search for a specific user in the users bar chart on the dashboard.

**Example request:**
```
GET /cost/users?range=7d&search=dennis
```

**Response shape:** Unchanged — same `UserLeaderboardRow[]`. Just filtered.

**Implementation hint:**
```python
if search:
    conditions.append("(u.name ILIKE :search OR u.email ILIKE :search)")
    params["search"] = f"%{search}%"
```

---

## Change 3: New endpoint — `/cost/users/{user_id}/sessions`

**Purpose:** Return a list of chat sessions for a specific user, ranked by total cost. This powers the "most expensive conversations" table on the user detail page.

**Request:**
```
GET /cost/users/{user_id}/sessions?range=7d&limit=20&offset=0
```

| Param | In | Type | Description |
|---|---|---|---|
| `user_id` | path | UUID | Required. |
| `range` | query | string | Optional, default `7d`. Same range logic as other endpoints. |
| `from` | query | ISO datetime | Optional, for custom range. |
| `to` | query | ISO datetime | Optional, for custom range. |
| `limit` | query | int | Optional, default `20`, max `100`. |
| `offset` | query | int | Optional, default `0`. For pagination. |

**Auth:** Admin only. Return 403 for non-admins. Return 404 if user doesn't exist (don't leak existence to non-admins the same way the existing user endpoints work).

**Response:** `UserSessionRow[]`, ordered by `total_cost DESC` (most expensive first).

```ts
interface UserSessionRow {
  session_id: string;          // UUID — the user_sessions.id
  title: string | null;        // user_sessions.title (nullable, max 256 chars)
  total_cost: number;          // SUM(cost_events.total_cost) for this session
  total_tokens: number;        // SUM(input_tokens + output_tokens)
  turn_count: number;          // COUNT(DISTINCT turn_id)
  top_model: string | null;    // The model used most (by cost) in this session
  first_message_at: string;    // MIN(cost_events.occurred_at) — ISO datetime
  last_message_at: string;     // MAX(cost_events.occurred_at) — ISO datetime
  error_count: number;         // COUNT where error_kind IS NOT NULL
}
```

**SQL sketch:**
```sql
SELECT
  us.id                                   AS session_id,
  us.title,
  COALESCE(SUM(ce.total_cost), 0)         AS total_cost,
  COALESCE(SUM(ce.input_tokens + ce.output_tokens), 0) AS total_tokens,
  COUNT(DISTINCT ce.turn_id)              AS turn_count,
  (SELECT ce2.model FROM cost_events ce2
   WHERE ce2.session_id = us.id
   GROUP BY ce2.model ORDER BY SUM(ce2.total_cost) DESC LIMIT 1) AS top_model,
  MIN(ce.occurred_at)                     AS first_message_at,
  MAX(ce.occurred_at)                     AS last_message_at,
  COUNT(*) FILTER (WHERE ce.error_kind IS NOT NULL) AS error_count
FROM user_sessions us
JOIN cost_events ce ON ce.session_id = us.id
WHERE us.user_id = :user_id
  AND ce.occurred_at >= :range_from
  AND ce.occurred_at < :range_to
GROUP BY us.id, us.title
ORDER BY total_cost DESC
LIMIT :limit OFFSET :offset;
```

---

## Change 4: Add `session_id` filter to `/cost/events`

**Current behaviour:** `GET /cost/events` accepts `?limit=` and `?channel=` (repeatable list) only. The `cost_events` table **does** store `session_id` (nullable UUID, indexed) and `EventRow` already includes it in the response — but there's no query parameter to filter by it.

**Required change:** Accept an optional `?session_id=<UUID>` query parameter. When present, add a WHERE clause to scope results to that session only.

This lets the frontend show all cost events for a specific conversation when the admin drills into a session.

**Example request:**
```
GET /cost/events?session_id=abc-123&limit=100
```

**Response shape:** Unchanged — same `EventRow[]`. Just filtered.

**Implementation hint:**
```python
session_id: UUID | None = Query(None)

# In the query builder:
if session_id:
    conditions.append("ce.session_id = :session_id")
    params["session_id"] = session_id
```

**Auth:** Admin only (same as existing `/cost/events`).

---

## Summary of changes

| # | Type | Endpoint | What to add | Effort |
|---|---|---|---|---|
| 1 | Extend | `GET /cost/timeseries` | `?user_id=` filter | Small (1 WHERE clause) |
| 2 | Extend | `GET /cost/users` | `?search=` filter | Small (1 ILIKE clause) |
| 3 | New | `GET /cost/users/{user_id}/sessions` | New route + query | Medium |
| 4 | Extend | `GET /cost/events` | `?session_id=` filter | Small (1 WHERE clause) |

## Testing checklist

1. `GET /cost/timeseries?range=7d&granularity=day&user_id=<valid_user_id>` returns points scoped to that user only. Without `user_id`, behaviour is unchanged (returns global data).
2. `GET /cost/users?range=7d&search=dennis` returns only users matching "dennis" in name or email. Without `search`, returns all users as before.
3. `GET /cost/users/<user_id>/sessions?range=7d` returns sessions sorted by cost descending. Each row has `session_id`, `title`, `total_cost`, `total_tokens`, `turn_count`, `top_model`, `first_message_at`, `last_message_at`, `error_count`.
4. `GET /cost/events?session_id=<valid_session_id>` returns only events for that session. Without `session_id`, returns all events as before.
5. Non-admin calls to all four return 403.
6. All existing endpoints continue to work exactly as before (backward compatibility).
