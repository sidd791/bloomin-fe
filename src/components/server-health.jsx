import React, { useState, useEffect, useCallback } from 'react'
import {
  Server, Cpu, MemoryStick, HardDrive, Network, Activity,
  Container, RefreshCw, ChevronDown, ChevronRight,
  Clock, Wifi, WifiOff, ArrowLeft, Logs,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HostingerService } from '@/services/hostinger.service'

const INSTANCE_LABELS = {
  'pg.milvus': { name: 'Database & Vector', desc: 'PostgreSQL + Milvus', icon: HardDrive },
  'openclaw': { name: 'Backend Services', desc: 'OpenClaw + FastAPI', icon: Server },
}

function getLabelForVM(vm) {
  if (INSTANCE_LABELS[vm.hostname]) return INSTANCE_LABELS[vm.hostname]
  const h = (vm.hostname || '').toLowerCase()
  if (h.includes('pg') || h.includes('milvus') || h.includes('database')) {
    return { name: 'Database & Vector', desc: 'PostgreSQL + Milvus', icon: HardDrive }
  }
  if (h.includes('openclaw') || h.includes('api') || h.includes('backend')) {
    return { name: 'Backend Services', desc: 'OpenClaw + FastAPI', icon: Server }
  }
  if (h.includes('frontend') || h.includes('web') || h.includes('app')) {
    return { name: 'Frontend', desc: 'Vite / React App', icon: Network }
  }
  return { name: vm.hostname, desc: vm.plan, icon: Server }
}

function StatusDot({ state }) {
  const color = state === 'running'
    ? 'bg-emerald-400 shadow-emerald-400/50'
    : state === 'stopped'
      ? 'bg-red-400 shadow-red-400/50'
      : 'bg-amber-400 shadow-amber-400/50'
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full shadow-[0_0_6px] ${color}`} />
  )
}

function MetricBar({ label, valueDisplay, pct }) {
  const warn = pct > 85
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={warn ? 'text-red-400 font-medium' : 'text-foreground'}>
          {valueDisplay}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${warn ? 'bg-red-400' : 'bg-primary'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

function MetricGauge({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3 py-2">
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-medium tabular-nums">{value}</p>
      </div>
    </div>
  )
}

function formatPort(p) {
  if (p.type === 'published' && p.host_port && p.container_port) {
    return `${p.host_port}:${p.container_port}/${p.protocol || 'tcp'}`
  }
  if (p.type === 'published_range' && p.container_port_start != null) {
    return `${p.container_port_start}-${p.container_port_end}/${p.protocol || 'tcp'}`
  }
  if (p.type === 'exposed_range' && p.container_port_start != null) {
    return `${p.container_port_start}-${p.container_port_end}/${p.protocol || 'tcp'}`
  }
  if (p.container_port) return `${p.container_port}/${p.protocol || 'tcp'}`
  return null
}

function deduplicatePorts(ports) {
  if (!ports?.length) return []
  const seen = new Set()
  return ports.filter(p => {
    const label = formatPort(p)
    if (!label || seen.has(label)) return false
    seen.add(label)
    return true
  })
}

function ContainerCard({ container }) {
  const ports = deduplicatePorts(container.ports)

  return (
    <div className="rounded-lg border border-border/50 bg-card/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Container className="h-3.5 w-3.5 text-primary" />
        <span className="text-sm font-medium truncate">{container.name}</span>
        <StatusDot state={container.state} />
        <span className="text-xs text-muted-foreground ml-auto">
          {container.status || container.state}
        </span>
      </div>
      {container.image && (
        <p className="text-xs text-muted-foreground truncate pl-5.5">{container.image}</p>
      )}
      {container.stats && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {container.stats.cpu_percentage != null && (
            <MetricGauge label="CPU" value={`${container.stats.cpu_percentage.toFixed(1)}%`} icon={Cpu} />
          )}
          {container.stats.memory_usage != null && (
            <MetricGauge label="Memory" value={formatBytes(container.stats.memory_usage)} icon={MemoryStick} />
          )}
        </div>
      )}
      {ports.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {ports.map((p, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-mono">
              {formatPort(p)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function DockerProjectSection({ project }) {
  const [expanded, setExpanded] = useState(false)
  const containers = project.containers || []
  const runningCount = containers.filter(c => c.state === 'running').length

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Logs className="h-3.5 w-3.5 text-primary" />
        <span className="text-sm font-medium">{project.name}</span>
        <span className="text-xs text-muted-foreground">
          ({runningCount}/{containers.length} containers)
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <StatusDot state={project.state || (runningCount > 0 ? 'running' : 'stopped')} />
          {project.status || project.state}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/40">
          {containers.length > 0 ? (
            <div className="grid gap-2 pt-2">
              {containers.map((c, i) => <ContainerCard key={c.name || i} container={c} />)}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">No containers found</p>
          )}
        </div>
      )}
    </div>
  )
}

function VMCard({ vm }) {
  const [expanded, setExpanded] = useState(true)
  const [dockerProjects, setDockerProjects] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loadingDocker, setLoadingDocker] = useState(false)

  const label = getLabelForVM(vm)
  const LabelIcon = label.icon

  const fetchDocker = useCallback(async () => {
    setLoadingDocker(true)
    try {
      const data = await HostingerService.listDockerProjects(vm.id)
      setDockerProjects(Array.isArray(data) ? data : data?.data || [])
    } catch {
      setDockerProjects([])
    } finally {
      setLoadingDocker(false)
    }
  }, [vm.id])

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await HostingerService.getMetrics(vm.id, 6)
      setMetrics(data)
    } catch {
      setMetrics(null)
    }
  }, [vm.id])

  useEffect(() => {
    fetchDocker()
    fetchMetrics()
  }, [fetchDocker, fetchMetrics])

  const cpuPct = getLatestValue(metrics, 'cpu_usage')
  const ramBytes = getLatestValue(metrics, 'ram_usage')
  const diskBytes = getLatestValue(metrics, 'disk_space')
  const uptimeSeconds = getLatestValue(metrics, 'uptime')
  const netIn = getLatestValue(metrics, 'incoming_traffic')
  const netOut = getLatestValue(metrics, 'outgoing_traffic')

  const totalRamBytes = vm.memory * 1024 * 1024
  const totalDiskBytes = vm.disk * 1024 * 1024
  const ramPct = ramBytes != null ? (ramBytes / totalRamBytes) * 100 : null
  const diskPct = diskBytes != null ? (diskBytes / totalDiskBytes) * 100 : null

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 shrink-0">
          <LabelIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{label.name}</h3>
            <StatusDot state={vm.state} />
            <span className="text-xs text-muted-foreground">{vm.state}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {label.desc} &middot; {vm.hostname}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground mr-2">
          <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{vm.cpus} vCPU</span>
          <span className="flex items-center gap-1"><MemoryStick className="h-3 w-3" />{formatMB(vm.memory)}</span>
          <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{formatMB(vm.disk)}</span>
        </div>
        {expanded
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border/50">
          <div className="grid gap-3 pt-4">
            <MetricBar
              label="CPU"
              pct={cpuPct ?? 0}
              valueDisplay={cpuPct != null ? `${cpuPct.toFixed(1)}%` : '—'}
            />
            <MetricBar
              label="Memory"
              pct={ramPct ?? 0}
              valueDisplay={
                ramBytes != null
                  ? `${formatBytes(ramBytes)} / ${formatMB(vm.memory)}`
                  : `— / ${formatMB(vm.memory)}`
              }
            />
            <MetricBar
              label="Disk"
              pct={diskPct ?? 0}
              valueDisplay={
                diskBytes != null
                  ? `${formatBytes(diskBytes)} / ${formatMB(vm.disk)}`
                  : `— / ${formatMB(vm.disk)}`
              }
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricGauge label="Plan" value={vm.plan || '—'} icon={Server} />
            <MetricGauge label="IPv4" value={vm.ipv4?.[0]?.address || '—'} icon={Wifi} />
            <MetricGauge
              label="Network I/O"
              value={netIn != null && netOut != null
                ? `${formatBytes(netIn)} / ${formatBytes(netOut)}`
                : formatMB(vm.bandwidth)}
              icon={Network}
            />
            <MetricGauge
              label="Uptime"
              value={uptimeSeconds != null ? formatUptime(uptimeSeconds) : '—'}
              icon={Clock}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Container className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Docker Projects
              </h4>
              {loadingDocker && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {dockerProjects === null ? (
              <div className="flex items-center justify-center py-3">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : dockerProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No Docker projects detected</p>
            ) : (
              <div className="grid gap-2">
                {dockerProjects.map((p, i) => (
                  <DockerProjectSection key={p.name || i} project={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ServerHealth({ onBack }) {
  const [vms, setVms] = useState(null)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchVMs = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const data = await HostingerService.listVMs()
      setVms(Array.isArray(data) ? data : data?.data || [])
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchVMs()
    const interval = setInterval(fetchVMs, 60_000)
    return () => clearInterval(interval)
  }, [fetchVMs])

  const runningCount = vms?.filter(v => v.state === 'running').length ?? 0
  const totalCount = vms?.length ?? 0

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="border-b border-border px-5 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Server Health
              </h1>
              <p className="text-xs text-muted-foreground">
                {vms ? (
                  <>
                    {runningCount}/{totalCount} instances running
                    {lastRefresh && <> &middot; Updated {lastRefresh.toLocaleTimeString()}</>}
                  </>
                ) : 'Loading instances...'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchVMs}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {vms && (
          <div className="flex flex-wrap items-center gap-4 mt-3">
            {vms.map(vm => {
              const label = getLabelForVM(vm)
              return (
                <div key={vm.id} className="flex items-center gap-1.5 text-xs">
                  <StatusDot state={vm.state} />
                  <span className="text-muted-foreground">{label.name}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive font-medium">Failed to load server data</p>
            </div>
            <p className="text-xs text-destructive/80 mt-1">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchVMs} className="mt-2">Retry</Button>
          </div>
        )}

        {!vms && !error && (
          <div className="space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-40 bg-muted rounded" />
                    <div className="h-3 w-60 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {vms?.map(vm => (
          <VMCard key={vm.id} vm={vm} />
        ))}
      </div>
    </div>
  )
}


/**
 * Extract the most recent value from a Hostinger metrics series.
 * Format: { "cpu_usage": { "unit": "%", "usage": { "timestamp": value, ... } } }
 */
function getLatestValue(metrics, key) {
  if (!metrics) return null
  const series = metrics[key]
  if (!series?.usage || typeof series.usage !== 'object') return null
  const timestamps = Object.keys(series.usage)
  if (timestamps.length === 0) return null
  const latest = timestamps.reduce((a, b) => (Number(a) > Number(b) ? a : b))
  return series.usage[latest] ?? null
}

function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatMB(mb) {
  if (mb == null) return '—'
  if (mb < 1024) return `${mb} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}

function formatUptime(seconds) {
  if (seconds == null) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h`
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}
