# Cost Dashboard — Frontend Spec (Hand-off)

> **Audience:** the Cursor agent working in the BloomBrain web repo on the Hostinger VPS.
> **Status:** API is live on `https://bloombrain.io/api` (FastAPI on the data VPS, proxied).
> All endpoints below are mounted at `/cost/...` under the BloomAI API and require the
> existing user auth bearer (same JWT the chat UI already uses).

## 1. What we built (backend side, already shipped)

A single wide table `cost_events` records one row **per LLM hop**. Every chat turn
(web or Slack) writes between 1 and N rows that share a common `turn_id`.

- **Web chat** (`/chat/sessions/{id}/messages`) records on every turn. Multi-hop
  turns (tool use, fallbacks) emit multiple rows with monotonic `hop_index`.
  Cost is captured even when the client disconnects mid-stream.
- **Slack chat** records via the OpenClaw `cost-logger` hook → POSTs to
  `/cost/ingest` (HMAC bearer). Slack user → bloombrain.io user mapping is
  done by email and refreshed every 6 hours.
- **Embeddings** (RAG search) record as `request_kind='embedding'` under
  `channel='autonomous'`.
- **Daily reconciliation** at 03:15 UTC compares our totals to OpenAI &
  Anthropic billing APIs; writes `cost_reconciliation`; alerts Slack if
  drift > 2%.

## 2. Routes you need to build

```
/cost                        Dashboard home — KPIs + headline charts
/cost/models                 Pricing table (read-only)
/cost/users/{user_id}        Admin: deep-dive on one user
/cost/turns/{turn_id}        Drill-down: per-hop view of one turn
```

Add a "Cost" entry to the main nav (only visible when logged in).
The admin views (`/cost/users/*`, the per-user leaderboard) only render when
`user.is_admin === true` — every non-admin sees only their own data.

## 3. API contracts

Every endpoint takes an optional **range** parameter:
`?range=24h|7d|30d|custom&from=ISO&to=ISO`. Default is `7d`.

### Self (any logged-in user)

| Method | Path | Returns |
|---|---|---|
| GET | `/cost/me/summary?range=7d` | `Summary` |
| GET | `/cost/me/events?limit=50` | `EventRow[]` |
| GET | `/cost/me/turns/{turn_id}` | `EventRow[]` — all hops of one turn |
| GET | `/cost/models` | `ModelPricingPublic[]` |

### Admin-only (returns 403 if `user.is_admin === false`)

| Method | Path | Returns |
|---|---|---|
| GET | `/cost/summary?range=7d&channel=web&channel=slack` | `Summary` (global) |
| GET | `/cost/timeseries?range=7d&granularity=day&group_by=model` | `TimeseriesPoint[]` |
| GET | `/cost/events?limit=100&channel=slack` | `EventRow[]` (global) |
| GET | `/cost/users?range=7d` | `UserLeaderboardRow[]` |
| GET | `/cost/users/{user_id}/summary?range=7d` | `Summary` for that user |
| GET | `/cost/reconciliation?days=7` | `ReconciliationRow[]` (drift badge) |
| POST | `/cost/sync-slack-users` | `{ok, inserted, updated, ...}` |

### Schemas (TypeScript)

```ts
type Range = '24h' | '7d' | '30d' | 'custom';

interface SummaryRow {
  key: string;           // e.g. 'web', 'openai/gpt-5.4', 'balanced'
  cost: number;          // USD
  tokens: number;
  requests: number;      // hop count
}

interface Summary {
  range_from: string;    // ISO datetime
  range_to: string;
  total_cost: number;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cached_tokens: number;
  request_count: number; // hops
  turn_count: number;    // logical user messages
  avg_cost_per_turn: number;
  fallback_waste_cost: number; // $ spent on failed primary calls that were retried
  by_channel: SummaryRow[];
  by_model: SummaryRow[];
  by_provider: SummaryRow[];
  by_mode: SummaryRow[];
  by_day: { day: string; cost: number; tokens: number; requests: number }[];
}

interface TimeseriesPoint {
  bucket: string;        // ISO datetime
  cost: number;
  tokens: number;
  requests: number;
  key?: string;          // present when group_by is set
}

interface EventRow {
  id: string;            // UUID
  occurred_at: string;
  channel: 'web' | 'slack' | 'autonomous';
  user_id: string | null;
  user_name: string | null;
  slack_user_id: string | null;
  slack_display_name: string | null;
  session_id: string | null;
  turn_id: string;
  hop_index: number;
  mode: 'thinking' | 'balanced' | string | null;
  model: string;
  provider: 'openai' | 'anthropic' | 'google' | 'unknown';
  request_kind: 'chat' | 'embedding' | 'no_llm' | string;
  is_fallback: boolean;
  service_tier: 'priority' | string | null;
  streaming: boolean;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  total_cost: number;
  latency_ms: number | null;
  had_tool_calls: boolean;
  tool_names: string[] | null;
  error_kind: string | null;
}

interface UserLeaderboardRow {
  user_id: string | null;
  name: string;
  email: string | null;
  is_slack_only: boolean;
  cost: number;
  turns: number;
  hops: number;
  top_model: string | null;
  cache_hit_ratio: number; // 0..1
}

interface ModelPricingPublic {
  model_id: string;          // 'openai/gpt-5.4'
  provider: 'openai' | 'anthropic' | 'google';
  input_per_1m: number;
  output_per_1m: number;
  cached_input_per_1m: number;
  cache_write_per_1m: number;
  priority_multiplier: number;
  notes: string | null;
  effective_from: string | null;
}

interface ReconciliationRow {
  day: string;               // YYYY-MM-DD
  provider: 'openai' | 'anthropic';
  model: string;
  tracked_total: number;
  provider_total: number;
  drift_pct: number;         // signed; positive = we over-report
}
```

## 4. Page layouts

### `/cost` (dashboard home)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ╔═ Total Spend ═╗ ╔═ Turns ═╗ ╔═ Avg / turn ═╗ ╔═ Cache hit% ═╗     │  KPI strip
│  ║   $12.43      ║ ║   1,204 ║ ║   $0.0103     ║ ║   34.2%       ║   │
│  ║   +18% wow    ║ ║   +12%  ║ ║   -3%         ║ ║   +6 pp       ║   │
│  ╚═══════════════╝ ╚═════════╝ ╚═══════════════╝ ╚═══════════════╝   │
│                                                                      │
│  ╔═ Reconciliation drift ═════════════════════════╗                  │
│  ║  All providers ✓  (max drift today: 0.34%)     ║  green/yellow/red badge
│  ╚═════════════════════════════════════════════════╝                  │
│                                                                      │
│  ┌─ Cost over time (stacked by provider) ──── range: 7d ▾ ────┐      │
│  │                                                            │      │
│  │     ▁▂▂▃▄▅▆▇█▆▅▄▃▂▁  (stacked area)                       │      │  Recharts <AreaChart>
│  └────────────────────────────────────────────────────────────┘      │
│                                                                      │
│  ┌─ By model ───────┐  ┌─ By channel ─────┐  ┌─ By mode ─────────┐  │
│  │   donut chart    │  │   donut chart    │  │   bar (h/v)       │  │
│  └──────────────────┘  └──────────────────┘  └────────────────────┘  │
│                                                                      │
│  ┌─ Hourly heatmap (admin only) ─ Mon..Sun × 0..23 ────────────┐    │
│  │   filled cells with cost                                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─ User leaderboard (admin only) ─────────────────────────────┐    │
│  │   name | cost | turns | top model | cache hit | ⤴︎ open      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─ Recent events ─────────────────────────────────────────────┐    │
│  │   timestamp | channel | user | model | tokens | cost | …    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

Behavioural notes:
- **KPI cards** show "vs prior period" deltas. Fetch the same `range` shifted
  back by its own length to compute `% change`.
- **Reconciliation drift badge** comes from `/cost/reconciliation?days=1` —
  green ≤ 0.5%, yellow ≤ 2%, red > 2%.
- **All charts respond to a single filter bar at the top** (range, channel
  multi-select, provider multi-select, model multi-select, mode multi-select).
- **Clicking any bar / wedge / row drills down** by appending its key to the
  filter (e.g. click "anthropic/claude-opus-4-6" → filter scopes to that model).
- **Events table row click** navigates to `/cost/turns/{turn_id}`.

### `/cost/turns/{turn_id}` (drill-down)

Shows the timeline of all hops for one turn:

```
Turn 8f3c-…  · user@trybloomin.com · 2026-06-06 14:21 UTC
─────────────────────────────────────────────────────────
[0]  user message      "Pull this week's TikTok winners"
[1]  openai/gpt-5.4    1.2k in (800 cached) → 412 out      $0.0080   2.1s    ⛏ rag.search
[2]  openai/gpt-5.4    1.6k in (1.4k cached) → 244 out     $0.0042   1.8s    ⛏ tiktok_lookup
[3]  openai/gpt-5.4    2.1k in (2.0k cached) → 891 out     $0.0143   3.2s    (final answer)
─────────────────────────────────────────────────────────
Total: 5 hops · $0.0265 · 6.1k tokens · 7.1s end-to-end
```

Each row shows a small `pricing snapshot` icon — hover for the exact pricing
version used (so a model that's since been re-priced still explains itself).

### `/cost/models`

Read-only table of every active row in `model_pricing`:

| model | provider | input | output | cached | cache-write | priority | notes |
|---|---|---|---|---|---|---|---|
| openai/gpt-5.4 | OpenAI | $2.50 | $15.00 | $1.25 | — | 2.0× | … |

(All values per 1M tokens; multiplier shown next to priority.)

### `/cost/users/{user_id}` (admin only)

Same layout as `/cost` but scoped to one user, with extra header showing:
- Name + email
- Linked Slack account (from `slack_user_map`)
- Whether they have `is_admin`
- Last active time

## 5. Filters & state

Top filter bar (sticky):

```
[Range ▾]   [Channel ▾]   [Provider ▾]   [Model ▾]   [Mode ▾]   [Tool ▾]   [Error only ☐]
```

URL state encoded in query string so links are shareable, e.g.
`/cost?range=30d&channel=slack&provider=anthropic`.

## 6. Theme & components (BloomBrain look)

- Already using **Tailwind + shadcn/ui** in the rest of the app. Match.
- Charts: **Recharts** (lightweight, already in repo for the analytics page).
- Heatmap: roll your own with grid + colour scale (`oklch`) — no need for a heavy lib.
- Money formatting: `$X.XXXX` for sub-dollar, `$X,XXX.XX` for dollar+ amounts.
- Tokens: human-format with k / M suffixes (12.3k, 4.1M).
- Latency: ms under 1000, otherwise seconds with one decimal.

## 7. Admin promotion (out of band)

For each person who needs the admin dashboard, run on the DB VPS:

```sql
UPDATE users SET is_admin = true WHERE email = 'dennis@trybloomin.com';
```

There is intentionally no UI for this — keeping admin flips a deliberate DB
operation prevents accidental promotions.

## 8. Known limitations (call out in UI)

- **Embedding cost is unattributed** in the per-user view (always `system`).
  RAG search is invoked by OpenClaw, which doesn't propagate the originating
  user into the `/search` endpoint. Show a small "ⓘ Embedding cost is shown
  in global view only" footnote on the per-user page.
- **Slack-only users** (no bloombrain.io account) appear with their Slack
  display name only. Once they sign up at bloombrain.io with the same email,
  they get auto-linked on the next 6h sync — historical Slack rows then start
  showing up under their bloombrain.io profile via `slack_user_map.user_id`.
- **The first ~60 seconds after a price change** can show stale numbers because
  the pricing cache TTL is 60s.

## 9. Empty-state copy

- No data in range: "No spend yet — start a chat or send a Slack DM to BloomBrain."
- Reconciliation row missing: "Provider hasn't reported usage for this period yet."
- User has no Slack mapping: "Slack account not linked. Use the same email at bloombrain.io to link automatically."

## 10. Where to ping if backend stops emitting

1. `tail -f /var/log/bloomin-api.log | grep -i cost`
2. If chat works but cost rows aren't appearing, the recorder swallowed an
   error — search logs for `record_chat_cost failed`.
3. If Slack rows aren't appearing, check OpenClaw logs:
   `journalctl -u openclaw -f | grep cost-logger`.
4. Drift > 2% Slack alert means our pricing table is out of date; update
   `scripts/seed_model_pricing.py` and re-run.
