# Dashboard

## Purpose

The Dashboard is the main screen of OpenStaff -- the PM2-style command center where users monitor all their AI Staff at a glance. It answers three questions instantly: "Are my Staff running?", "What are they costing me?", and "Are they performing well?" Non-developers should understand the state of their entire operation within 2 seconds of opening the app.

---

## Navigation

Sidebar order: **Dashboard** (active) > Skills > Agents > Registry > Settings

The Dashboard is the default landing screen after setup is complete.

---

## Layout

### Desktop (Electron window, >= 1024px)

```
+--+--------------------------------------------------------------+
|  |  HEADER                                                       |
|S |  [OpenStaff logo]              [+ Create Staff] (pill button) |
|I |--------------------------------------------------------------+
|D |                                                               |
|E |  SUMMARY CARDS ROW (4-column grid, gap-4)                    |
|B |  +---------------+ +---------------+ +---------------+ +-----+
|A |  | Active Staff  | | Cost Today    | | Cost Month    | |Cycle|
|R |  |     3 / 5     | |   $12.47      | |   $342.18     | | 147 |
|  |  |  2 err        | |  +18.3%       | |  +36.8%       | |+12% |
|  |  +---------------+ +---------------+ +---------------+ +-----+
|  |                                                               |
|  |  STAFF LIST (full-width Card)                                 |
|  |  +-----------------------------------------------------------+
|  |  | [Filter: All v] [Sort: Status v]        [Search______]    |
|  |  |-----------------------------------------------------------|
|  |  | St | Name              | Role       | Agent | Model |  Up |
|  |  |  . |                   |            |       |       | time|
|  |  |-----------------------------------------------------------|
|  |  | *  | Meta Ads Creative | Meta ads.. | CC    | s4.5  | 3d  |
|  |  |    | R:2  T:148K  $4.21  Cyc:47  CPI:$1.82 +12%         |
|  |  |-----------------------------------------------------------|
|  |  | *  | pSEO Writer       | SEO conte..| CC    | s4.5  | 5d  |
|  |  |    | R:0  T:92K   $2.88  Cyc:23  Imp:52K   +8.4%        |
|  |  |-----------------------------------------------------------|
|  |  | o  | Naver Cafe        | Naver Cafe.| CC    | s4.5  |  -- |
|  |  |    | R:5  T:0     $0.00  Cyc:12  Views:0    --           |
|  |  +-----------------------------------------------------------+
|  |                                                               |
|  |  SYSTEM RESOURCES BAR (full-width Card, compact)              |
|  |  +-----------------------------------------------------------+
|  |  |  CPU [====------] 42%    Memory [=======---] 71%  6.2 GB |
|  |  +-----------------------------------------------------------+
+--+--------------------------------------------------------------+

Legend:  * = green pulse dot (running)
        o = gray dot (stopped)
        x = red dot (error)
        ! = amber dot (warning/backoff)
```

### Grid Specification

```
Page container:   p-6, flex flex-col gap-6, max-w-full
Summary row:      grid grid-cols-4 gap-4
Staff list card:  col-span-full
Resource bar:     col-span-full
```

### Mobile / Ngrok Web (< 768px)

```
+----------------------------------------------+
|  [=] OpenStaff           [+ Create Staff]    |
|----------------------------------------------|
|  SUMMARY CARDS (2x2 grid, gap-3)            |
|  +----------+ +----------+                   |
|  | Active   | | Cost     |                   |
|  | 3 / 5    | | $12.47   |                   |
|  +----------+ +----------+                   |
|  +----------+ +----------+                   |
|  | Month    | | Cycles   |                   |
|  | $342.18  | | 147      |                   |
|  +----------+ +----------+                   |
|                                              |
|  STAFF CARDS (stacked, vertical)             |
|  +------------------------------------------+
|  | * Meta Ads Creative Designer             |
|  |   Meta ads creative designer             |
|  |   CC / Sonnet 4.5    Uptime: 3d 12h     |
|  |   Cost: $4.21   Cycles: 47              |
|  |   CPI: $1.82  +12%                      |
|  +------------------------------------------+
|  +------------------------------------------+
|  | * pSEO Writer                            |
|  |   ...                                    |
|  +------------------------------------------+
|                                              |
|  RESOURCES                                   |
|  CPU 42%  |  Mem 71%                         |
+----------------------------------------------+
```

---

## Components

### 1. Page Header

A flex row at the top of the page content area (not inside the sidebar).

```
Container: flex items-center justify-between
```

| Element | Details |
|---------|---------|
| Page title | `<h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>` |
| Create button | `<Button className="rounded-full gap-2"><Plus className="h-4 w-4" /> Create Staff</Button>` -- uses shadcn `Button` with default (primary) variant. Pill shape via `rounded-full`. Navigates to Staff creation screen. |

### 2. Summary Metric Cards

Four `<Card>` components in a `grid grid-cols-4 gap-4` row (collapses to `grid-cols-2` on mobile).

Each card structure:

```tsx
<Card className="p-6">
  <p className="text-sm text-muted-foreground">{label}</p>
  <div className="flex items-end gap-2 mt-1">
    <span className="text-3xl font-bold text-foreground">{value}</span>
    <TrendBadge value={trendPercent} />  // optional
  </div>
  <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
</Card>
```

| Card | Label | Value | Trend | Subtitle |
|------|-------|-------|-------|----------|
| Active Staff | "Active Staff" | `3 / 5` (running / total) | -- | `2 errors` in `text-destructive` if any errors exist |
| Cost Today | "Cost Today" | `$12.47` | `+18.3%` vs yesterday | -- |
| Cost This Month | "Cost This Month" | `$342.18` | `+36.8%` vs last month | -- |
| Total Cycles | "Cycles Completed" | `147` | `+12%` vs last period | `Today: 8` |

**TrendBadge component:**

```tsx
// Pill badge showing trend direction and percentage
<span className={cn(
  "text-xs font-medium px-2 py-0.5 rounded-full",
  positive ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
)}>
  {positive ? "↑" : "↓"}{value}%
</span>
```

### 3. Staff List Card

A single full-width `<Card>` containing a toolbar and table.

#### 3a. Toolbar

```
Container: flex items-center justify-between p-4 border-b border-border
```

| Element | Details |
|---------|---------|
| Status filter | `<Select>` dropdown. Options: All, Running, Stopped, Error. Filters the staff list. Uses shadcn `Select` with `rounded-full` trigger. |
| Sort control | `<Select>` dropdown. Options: Status, Name, Cost, Cycles, Uptime. Default: Status (running first). |
| Search | `<Input placeholder="Search staff..." className="rounded-full max-w-[240px]" />`. Filters by name and role. |

#### 3b. Table (Desktop)

Uses shadcn `<Table>` inside the card. Each row is clickable (navigates to Staff detail).

**Table header columns:**

| Column | Width | Class | Sortable |
|--------|-------|-------|----------|
| Status | 48px | `w-12 text-center` | Yes |
| Name | flex-1 | `min-w-[200px]` | Yes |
| Role | 180px | `text-muted-foreground truncate hidden lg:table-cell` | No |
| Agent | 80px | `hidden xl:table-cell` | No |
| Model | 100px | `hidden xl:table-cell` | No |
| Uptime | 80px | `text-right` | Yes |
| Restarts | 64px | `text-right text-muted-foreground` | Yes |
| Tokens | 90px | `text-right hidden lg:table-cell` | Yes |
| Cost | 80px | `text-right` | Yes |
| Cycles | 64px | `text-right` | Yes |
| KPI | 160px | `text-right hidden lg:table-cell` | No |
| Actions | 48px | `text-right` | No |

**Table row markup:**

```tsx
<TableRow
  className="cursor-pointer hover:bg-muted/50 transition-colors"
  onClick={() => navigate(`/staffs/${staff.id}`)}
>
  {/* Status dot */}
  <TableCell className="text-center">
    <StatusDot status={staff.status} />
  </TableCell>

  {/* Name + role (mobile shows role below name) */}
  <TableCell>
    <p className="font-medium text-foreground">{staff.name}</p>
  </TableCell>

  {/* Role */}
  <TableCell className="text-muted-foreground truncate hidden lg:table-cell">
    {staff.role}
  </TableCell>

  {/* Agent */}
  <TableCell className="hidden xl:table-cell">
    <span className="text-xs text-muted-foreground">{staff.agent === 'claude-code' ? 'CC' : 'Codex'}</span>
  </TableCell>

  {/* Model -- abbreviated */}
  <TableCell className="hidden xl:table-cell">
    <span className="text-xs text-muted-foreground">{formatModel(staff.model)}</span>
  </TableCell>

  {/* Uptime */}
  <TableCell className="text-right font-mono text-sm">
    {staff.status === 'running' ? formatUptime(staff.uptime) : '--'}
  </TableCell>

  {/* Restarts */}
  <TableCell className="text-right text-muted-foreground text-sm">
    {staff.restarts}
  </TableCell>

  {/* Tokens today */}
  <TableCell className="text-right font-mono text-sm hidden lg:table-cell">
    {formatTokens(staff.tokensToday)}
  </TableCell>

  {/* Cost today */}
  <TableCell className="text-right font-mono text-sm">
    ${staff.costToday.toFixed(2)}
  </TableCell>

  {/* Cycles */}
  <TableCell className="text-right text-sm">
    {staff.cycles}
  </TableCell>

  {/* KPI summary */}
  <TableCell className="text-right hidden lg:table-cell">
    <KpiSummary kpis={staff.latestKpi} />
  </TableCell>

  {/* Actions (stop propagation to prevent row click) */}
  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
    <StaffActions staff={staff} />
  </TableCell>
</TableRow>
```

#### 3c. Staff Cards (Mobile < 768px)

On mobile, replace the table with stacked cards. Each staff becomes a standalone `<Card>`.

```tsx
<Card
  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
  onClick={() => navigate(`/staffs/${staff.id}`)}
>
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <StatusDot status={staff.status} />
      <div>
        <p className="font-medium text-foreground">{staff.name}</p>
        <p className="text-sm text-muted-foreground">{staff.role}</p>
      </div>
    </div>
    <StaffActions staff={staff} />
  </div>
  <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
    <div>
      <p className="text-muted-foreground text-xs">Cost</p>
      <p className="font-mono">${staff.costToday.toFixed(2)}</p>
    </div>
    <div>
      <p className="text-muted-foreground text-xs">Cycles</p>
      <p>{staff.cycles}</p>
    </div>
    <div>
      <p className="text-muted-foreground text-xs">Uptime</p>
      <p className="font-mono">{formatUptime(staff.uptime)}</p>
    </div>
  </div>
  {staff.latestKpi && (
    <div className="mt-2 pt-2 border-t border-border">
      <KpiSummary kpis={staff.latestKpi} />
    </div>
  )}
</Card>
```

### 4. StatusDot

The status indicator dot. Follows the design system strictly.

```tsx
export function StatusDot({ status }: { status: StaffStatus }) {
  const styles = {
    running: 'bg-success animate-status-pulse',
    stopped: 'bg-muted-foreground',
    error: 'bg-destructive',
    warning: 'bg-warning',
  }
  return <div className={cn('w-2 h-2 rounded-full', styles[status])} />
}
```

### 5. KpiSummary

Displays the latest KPI value with a trend arrow in a pill badge.

```tsx
// Example: "CPI: $1.82" with a green pill "↑12%"
<div className="flex items-center gap-2 justify-end">
  <span className="text-sm text-muted-foreground">{kpi.label}: {kpi.formattedValue}</span>
  <TrendBadge value={kpi.trendPercent} />
</div>
```

If a staff has multiple KPIs, show only the primary one in the table. Full KPIs are visible on the Staff detail KPI tab.

### 6. StaffActions

A dropdown menu on each staff row for quick actions. Uses shadcn `DropdownMenu`.

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    {staff.status === 'running' ? (
      <DropdownMenuItem onClick={() => stopStaff(staff.id)}>
        <Square className="h-4 w-4 mr-2" /> Stop
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem onClick={() => startStaff(staff.id)}>
        <Play className="h-4 w-4 mr-2" /> Start
      </DropdownMenuItem>
    )}
    <DropdownMenuItem onClick={() => restartStaff(staff.id)}>
      <RotateCw className="h-4 w-4 mr-2" /> Restart
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => navigate(`/staffs/${staff.id}`)}>
      <Eye className="h-4 w-4 mr-2" /> View Details
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      className="text-destructive"
      onClick={() => confirmDelete(staff.id)}
    >
      <Trash2 className="h-4 w-4 mr-2" /> Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 7. System Resources Bar

A compact, full-width `<Card>` at the bottom showing system resource usage.

```tsx
<Card className="p-4">
  <div className="flex items-center gap-8">
    <ResourceMeter label="CPU" value={cpuPercent} />
    <ResourceMeter label="Memory" value={memPercent} detail={`${memUsedGB} / ${memTotalGB} GB`} />
  </div>
</Card>
```

**ResourceMeter sub-component:**

```tsx
<div className="flex items-center gap-3 flex-1">
  <span className="text-sm text-muted-foreground w-16">{label}</span>
  {/* Progress bar track */}
  <div className="flex-1 h-2 rounded-full bg-muted">
    {/* Fill */}
    <div
      className={cn(
        'h-full rounded-full transition-all',
        value > 90 ? 'bg-destructive' : value > 70 ? 'bg-warning' : 'bg-success'
      )}
      style={{ width: `${value}%` }}
    />
  </div>
  <span className="text-sm font-mono text-foreground w-12 text-right">{value}%</span>
  {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
</div>
```

Colors shift based on load: green (normal) -> amber (>70%) -> red (>90%).

---

## Data Requirements

### REST API Endpoints

| Endpoint | Method | Description | Response Shape |
|----------|--------|-------------|----------------|
| `/api/staffs` | GET | List all staff with summary data | `Staff[]` |
| `/api/staffs/:id/start` | POST | Start a staff | `{ status: 'running' }` |
| `/api/staffs/:id/stop` | POST | Stop a staff | `{ status: 'stopped' }` |
| `/api/staffs/:id/restart` | POST | Restart a staff | `{ status: 'running' }` |
| `/api/staffs/:id` | DELETE | Delete a staff | `204 No Content` |
| `/api/system/resources` | GET | CPU + memory usage | `{ cpu: number, memory: { used: number, total: number } }` |
| `/api/stats/summary` | GET | Aggregate stats (costs, cycle totals) | `DashboardSummary` |

### Staff Response Shape

```typescript
interface Staff {
  id: string
  name: string
  role: string
  agent: 'claude-code' | 'codex'
  model: string
  status: 'running' | 'stopped' | 'error' | 'warning'
  uptime: number              // seconds since last start, 0 if not running
  restarts: number            // from errors.jsonl crash count
  tokensToday: number         // total tokens consumed today
  costToday: number           // USD cost today
  cycles: number              // total completed cycles from cycles.jsonl
  latestKpi: KpiMetric | null // most recent KPI entry from kpi.jsonl
}

interface KpiMetric {
  label: string            // e.g. "CPI"
  value: number
  formattedValue: string   // e.g. "$1.82"
  trendPercent: number     // e.g. 12.3 means +12.3%
}

interface DashboardSummary {
  activeCount: number
  totalCount: number
  errorCount: number
  costToday: number
  costTodayTrend: number      // % change vs yesterday
  costMonth: number
  costMonthTrend: number      // % change vs last month
  totalCycles: number
  cyclesToday: number
  cycleTrend: number          // % change
}

interface SystemResources {
  cpu: number                 // 0-100 percentage
  memory: {
    used: number              // GB
    total: number             // GB
    percent: number           // 0-100
  }
}
```

### WebSocket Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `staff:status` | server -> client | `{ id, status, uptime }` | Staff status change |
| `staff:metrics` | server -> client | `{ id, tokensToday, costToday, cycles }` | Periodic metric update (every 30s) |
| `staff:kpi` | server -> client | `{ id, kpi: KpiMetric }` | New KPI recorded |
| `system:resources` | server -> client | `SystemResources` | System resource update (every 10s) |

### TanStack Query Keys

```typescript
// Staff list -- refetch on WebSocket events
queryKey: ['staffs']

// Dashboard summary -- refetch on WebSocket events
queryKey: ['dashboard', 'summary']

// System resources -- refetch on WebSocket events
queryKey: ['system', 'resources']
```

---

## Interactions

| User Action | Behavior |
|-------------|----------|
| Click staff row | Navigate to `/staffs/{id}` (Staff detail screen) |
| Click "+ Create Staff" | Navigate to Staff creation screen |
| Click Start/Stop/Restart in dropdown | POST to corresponding API endpoint. Optimistic UI update: status dot changes immediately, reverts on error. Show toast on success/failure. |
| Click Delete in dropdown | Show confirmation dialog: "Delete {staffName}? This will stop the staff and remove all data. This cannot be undone." On confirm: DELETE API call, remove row with exit animation. |
| Change filter dropdown | Filter staff list client-side. "All" shows all, "Running" / "Stopped" / "Error" show only matching. |
| Change sort dropdown | Sort staff list client-side. Status sort order: error > warning > running > stopped. |
| Type in search input | Filter client-side by name and role (case-insensitive substring match). Debounce 300ms. |
| Click table header column | Toggle sort ascending/descending for that column. Show sort arrow indicator. |

---

## States

### Loading State

Show skeleton placeholders while data is being fetched.

```
Summary cards:  4 skeleton cards with shimmer animation (shadcn Skeleton)
                Each card: Skeleton for label (w-20 h-3), Skeleton for value (w-24 h-8)

Staff list:     5 skeleton rows in the table
                Each row: Skeleton dot (w-2 h-2 rounded-full),
                          Skeleton text blocks for each column

Resource bar:   Skeleton bars (w-full h-2) for CPU and Memory
```

Use shadcn `<Skeleton className="..." />` components. Animate with default shimmer.

### Empty State (No Staff Created)

Centered inside the Staff list card when the staff array is empty.

```tsx
<div className="flex flex-col items-center justify-center py-16 px-4 text-center">
  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
    <Users className="w-8 h-8 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-semibold text-foreground">No Staff yet</h3>
  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
    Create your first AI Staff to start automating tasks around the clock.
  </p>
  <Button className="rounded-full mt-6 gap-2" onClick={() => navigate('/staffs/new')}>
    <Plus className="h-4 w-4" /> Create Staff
  </Button>
</div>
```

Summary cards still render but show zero values (`0 / 0`, `$0.00`, `0`). No trend badges shown when there is no historical data.

### Error State (API Failure)

If the main data fetch fails, show an inline error inside the Staff list card.

```tsx
<div className="flex flex-col items-center justify-center py-16 px-4 text-center">
  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
    <AlertTriangle className="w-8 h-8 text-destructive" />
  </div>
  <h3 className="text-lg font-semibold text-foreground">Failed to load Staff</h3>
  <p className="text-sm text-muted-foreground mt-1">
    Could not connect to the OpenStaff server. Check that the app is running.
  </p>
  <Button variant="outline" className="rounded-full mt-6" onClick={() => refetch()}>
    Retry
  </Button>
</div>
```

### WebSocket Disconnected

When the WebSocket connection drops, show a subtle top banner.

```tsx
<div className="bg-warning/10 text-warning px-4 py-2 text-sm text-center rounded-lg mx-6 mt-2">
  Live updates paused. Reconnecting...
</div>
```

Auto-hide when reconnected. Data falls back to polling (TanStack Query `refetchInterval: 30000`).

---

## Responsive Behavior

| Breakpoint | Layout Changes |
|------------|----------------|
| >= 1280px (xl) | Full table with all columns visible. Summary cards 4-col grid. |
| 1024-1279px (lg) | Hide Agent, Model columns from table. Everything else visible. |
| 768-1023px (md) | Hide Role, Tokens, KPI columns. Summary cards remain 4-col. Sidebar collapses to icon-only. |
| < 768px (sm) | Summary cards become 2x2 grid. Staff list switches from table to stacked cards. Resource bar becomes a compact two-item row. Sidebar becomes a hamburger menu overlay. Search input becomes full-width above filter/sort. |

### Mobile-specific adjustments

- Staff cards: full width, stacked vertically with `gap-3`
- Summary cards: `grid grid-cols-2 gap-3` with reduced padding `p-4`
- Metric values scale down: `text-2xl` instead of `text-3xl`
- Create button in header: icon-only (`<Plus />`) on smallest screens, with tooltip
- Resource bar: simplified to just percentage text, no progress bars on very small screens
