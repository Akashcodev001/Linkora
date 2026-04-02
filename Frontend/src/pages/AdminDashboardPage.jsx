import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Skeleton from '@/components/ui/Skeleton'
import { ShieldAlert, Users, Cpu, BrainCircuit, Clock3 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  getAdminQuotaAuditCsvUrl,
  getAdminUsersCsvUrl,
  useDeleteAdminUserMutation,
  useGetAdminOverviewQuery,
  useGetAdminUsersQuery,
  useReactivateAdminUserMutation,
  useSuspendAdminUserMutation,
  useUpdateAdminUserQuotaMutation,
} from '@/app/api/adminApi'

function MetricCard({ icon: Icon, label, value, helper }) {
  return (
    <Card className="space-y-2" padding="comfortable">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
        <Icon size={16} className="text-brand" />
      </div>
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
      <p className="text-xs text-text-secondary">{helper}</p>
    </Card>
  )
}

function UsageTimelineChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="grid h-[260px] place-items-center rounded-default border border-border/70 bg-bg-hover/30 text-sm text-text-muted">
        No timeline data available yet.
      </div>
    )
  }

  const width = 780
  const height = 260
  const padding = 30

  const maxRequests = Math.max(...data.map((point) => Number(point.requests || 0)), 1)
  const maxActiveUsers = Math.max(...data.map((point) => Number(point.activeUsers || 0)), 1)
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  const requestPoints = data
    .map((point, index) => {
      const x = padding + (index / Math.max(data.length - 1, 1)) * chartWidth
      const y = padding + chartHeight - (Number(point.requests || 0) / maxRequests) * chartHeight
      return `${x},${y}`
    })
    .join(' ')

  const userBarWidth = chartWidth / Math.max(data.length, 1) - 3

  return (
    <div className="w-full overflow-x-auto rounded-default border border-border/70 bg-bg-base p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px]">
        <defs>
          <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <rect x={padding} y={padding} width={chartWidth} height={chartHeight} fill="transparent" stroke="rgba(148,163,184,0.35)" />

        {data.map((point, index) => {
          const x = padding + (index / Math.max(data.length - 1, 1)) * chartWidth
          const y = padding + chartHeight - (Number(point.activeUsers || 0) / maxActiveUsers) * chartHeight
          const barHeight = padding + chartHeight - y

          return (
            <g key={point.day}>
              <rect
                x={x - userBarWidth / 2}
                y={y}
                width={Math.max(2, userBarWidth)}
                height={barHeight}
                fill="rgba(59,130,246,0.25)"
              />
              {index % Math.ceil(data.length / 6) === 0 ? (
                <text x={x} y={height - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
                  {dayjs(point.day).format('DD MMM')}
                </text>
              ) : null}
            </g>
          )
        })}

        <polyline fill="none" stroke="#f97316" strokeWidth="2.5" points={requestPoints} />

        <polygon
          fill="url(#requestsGradient)"
          points={`${padding},${padding + chartHeight} ${requestPoints} ${padding + chartWidth},${padding + chartHeight}`}
        />
      </svg>
    </div>
  )
}

function UserQuotaRow({ user, onSave, onSuspend, onReactivate, onDelete, saving, actionLoading }) {
  const [maxItems, setMaxItems] = useState(user?.quota?.maxItems || 100)
  const [aiJobsPerDay, setAiJobsPerDay] = useState(user?.quota?.aiJobsPerDay || 50)

  return (
    <tr className="border-b border-border/60 text-sm">
      <td className="px-3 py-2 align-top">
        <p className="font-medium text-text-primary">{user.username}</p>
        <p className="text-xs text-text-muted">{user.email}</p>
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-wrap gap-1">
          <Badge size="sm" variant={user.role === 'admin' ? 'warning' : 'default'}>{user.role}</Badge>
          <Badge size="sm" variant="brand">{user.subscriptionTier}</Badge>
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        <p className="text-xs text-text-secondary">AI: {user.quota.currentAiJobsToday}/{user.quota.aiJobsPerDay}</p>
        <p className="text-xs text-text-secondary">Items: {user.quota.currentItems}/{user.quota.maxItems}</p>
        <div className="mt-1 flex gap-1">
          {user.quota.aiLimitReached ? <Badge size="sm" variant="error">AI limit reached</Badge> : null}
          {!user.quota.aiLimitReached && user.quota.aiUsagePercent >= 80 ? <Badge size="sm" variant="warning">Near AI limit</Badge> : null}
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            type="number"
            min={1}
            value={maxItems}
            onChange={(event) => setMaxItems(Number(event.target.value || 1))}
            className="text-xs"
            wrapperClassName="min-w-[120px]"
          />
          <Input
            type="number"
            min={1}
            value={aiJobsPerDay}
            onChange={(event) => setAiJobsPerDay(Number(event.target.value || 1))}
            className="text-xs"
            wrapperClassName="min-w-[120px]"
          />
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            loading={saving}
            onClick={() => onSave(user.id, { maxItems, aiJobsPerDay })}
          >
            Save Limits
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          {user.isSuspended ? (
            <Button size="sm" variant="secondary" loading={actionLoading} onClick={() => onReactivate(user.id)}>
              Reactivate
            </Button>
          ) : (
            <Button size="sm" variant="secondary" loading={actionLoading} onClick={() => onSuspend(user.id)}>
              Suspend
            </Button>
          )}
          {!user.isDeleted ? (
            <Button size="sm" variant="danger" loading={actionLoading} onClick={() => onDelete(user.id)}>
              Delete
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

export function AdminDashboardPage() {
  const { user } = useAuth()
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin'

  const [windowDays, setWindowDays] = useState(14)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [savingUserId, setSavingUserId] = useState(null)
  const [actingUserId, setActingUserId] = useState(null)

  const {
    data: overviewData,
    isLoading: overviewLoading,
    isFetching: overviewFetching,
    isError: overviewError,
    error: overviewErrorPayload,
    refetch: refetchOverview,
  } = useGetAdminOverviewQuery({ windowDays, topUsers: 12 }, { skip: !isAdmin })

  const {
    data: usersData,
    isLoading: usersLoading,
    isFetching: usersFetching,
    isError: usersError,
    error: usersErrorPayload,
    refetch: refetchUsers,
  } = useGetAdminUsersQuery({ page, limit: 20, query, role: roleFilter, status: statusFilter, sortBy, sortOrder }, { skip: !isAdmin })

  const [updateQuota, { isLoading: updateQuotaLoading }] = useUpdateAdminUserQuotaMutation()
  const [suspendUser, { isLoading: suspendLoading }] = useSuspendAdminUserMutation()
  const [reactivateUser, { isLoading: reactivateLoading }] = useReactivateAdminUserMutation()
  const [deleteUser, { isLoading: deleteLoading }] = useDeleteAdminUserMutation()

  const metrics = overviewData?.data?.metrics || overviewData?.metrics || {}
  const timeline = overviewData?.data?.timeline || overviewData?.timeline || []
  const users = usersData?.data?.items || usersData?.items || []
  const pagination = usersData?.data?.pagination || usersData?.pagination || { page: 1, totalPages: 1, total: users.length }

  const actionLoading = suspendLoading || reactivateLoading || deleteLoading

  const summary = useMemo(() => {
    const usersAtLimit = Number(metrics?.usersAtAiLimit || 0)
    const usersNear = Number(metrics?.usersNearAiLimit || 0)
    return `AI quota watch: ${usersAtLimit} reached limit, ${usersNear} near limit.`
  }, [metrics?.usersAtAiLimit, metrics?.usersNearAiLimit])

  const handleSaveQuota = async (userId, payload) => {
    setSavingUserId(userId)
    try {
      await updateQuota({ userId, ...payload }).unwrap()
      toast.success('User limits updated')
      refetchUsers()
      refetchOverview()
    } catch (error) {
      toast.error(error?.data?.message || 'Could not update user limits')
    } finally {
      setSavingUserId(null)
    }
  }

  const handleSuspend = async (userId) => {
    setActingUserId(userId)
    try {
      await suspendUser({ userId, reason: 'Suspended by admin' }).unwrap()
      toast.success('User suspended')
      refetchUsers()
    } catch (error) {
      toast.error(error?.data?.message || 'Could not suspend user')
    } finally {
      setActingUserId(null)
    }
  }

  const handleReactivate = async (userId) => {
    setActingUserId(userId)
    try {
      await reactivateUser(userId).unwrap()
      toast.success('User reactivated')
      refetchUsers()
    } catch (error) {
      toast.error(error?.data?.message || 'Could not reactivate user')
    } finally {
      setActingUserId(null)
    }
  }

  const handleDelete = async (userId) => {
    const confirmed = window.confirm('Soft delete this user?')
    if (!confirmed) return

    setActingUserId(userId)
    try {
      await deleteUser(userId).unwrap()
      toast.success('User deleted')
      refetchUsers()
    } catch (error) {
      toast.error(error?.data?.message || 'Could not delete user')
    } finally {
      setActingUserId(null)
    }
  }

  const handleUsersCsvExport = () => {
    const url = getAdminUsersCsvUrl({ query, role: roleFilter, status: statusFilter, sortBy, sortOrder })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleQuotaAuditCsvExport = () => {
    const url = getAdminQuotaAuditCsvUrl({ limit: 5000 })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Admin access required"
        description="Your account does not have admin privileges. Ask an existing admin to grant access."
      />
    )
  }

  if (overviewLoading || usersLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-[320px] w-full" />
        <Skeleton className="h-[260px] w-full" />
      </div>
    )
  }

  if (overviewError || usersError) {
    return (
      <ErrorState
        title="Could not load admin dashboard"
        message={overviewErrorPayload?.data?.message || usersErrorPayload?.data?.message || 'Please try again.'}
        onRetry={() => {
          refetchOverview()
          refetchUsers()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3" padding="comfortable">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Admin Control Center</h1>
            <p className="text-sm text-text-secondary">Monitor AI consumption, user growth, and quota enforcement.</p>
            <p className="mt-1 text-xs text-text-muted">{summary}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={7}
              max={90}
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value || 14))}
              wrapperClassName="w-[130px]"
              className="text-sm"
            />
            <Button size="sm" variant="secondary" onClick={refetchOverview} loading={overviewFetching}>
              Refresh Stats
            </Button>
            <Button size="sm" variant="secondary" onClick={handleUsersCsvExport}>
              Export Users CSV
            </Button>
            <Button size="sm" variant="secondary" onClick={handleQuotaAuditCsvExport}>
              Export Audit CSV
            </Button>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Total users"
          value={Number(metrics.totalUsers || 0).toLocaleString()}
          helper={`Items: ${Number(metrics.totalItems || 0).toLocaleString()}`}
        />
        <MetricCard
          icon={BrainCircuit}
          label="Total AI jobs"
          value={Number(metrics.totalJobs || 0).toLocaleString()}
          helper={`Success rate: ${Number(metrics.successRate || 0).toFixed(1)}%`}
        />
        <MetricCard
          icon={Cpu}
          label="Pending jobs"
          value={Number(metrics.pendingJobs || 0).toLocaleString()}
          helper={`Failed: ${Number(metrics.failedJobs || 0).toLocaleString()}`}
        />
        <MetricCard
          icon={Clock3}
          label="Users at AI limit"
          value={Number(metrics.usersAtAiLimit || 0).toLocaleString()}
          helper={`Near limit: ${Number(metrics.usersNearAiLimit || 0).toLocaleString()}`}
        />
      </section>

      <Card className="space-y-3" padding="comfortable">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">AI Usage Over Time</h2>
            <p className="text-xs text-text-muted">Orange line = requests/day. Blue bars = active users/day.</p>
          </div>
          <Badge variant="brand" size="sm">Last {windowDays} days</Badge>
        </div>
        <UsageTimelineChart data={timeline} />
      </Card>

      <Card className="space-y-3" padding="comfortable">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">User Maintenance</h2>
            <p className="text-xs text-text-muted">Update AI and item limits to keep usage under control.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search user/email"
              wrapperClassName="w-[220px]"
            />
            <select
              className="h-10 rounded-default border border-border bg-bg-surface px-3 text-sm text-text-primary"
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
            <select
              className="h-10 rounded-default border border-border bg-bg-surface px-3 text-sm text-text-primary"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deleted">Deleted</option>
              <option value="all">All statuses</option>
            </select>
            <select
              className="h-10 rounded-default border border-border bg-bg-surface px-3 text-sm text-text-primary"
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value)
                setPage(1)
              }}
            >
              <option value="createdAt">Sort: Created</option>
              <option value="updatedAt">Sort: Updated</option>
              <option value="username">Sort: Username</option>
              <option value="email">Sort: Email</option>
              <option value="aiUsage">Sort: AI Usage</option>
              <option value="itemUsage">Sort: Item Usage</option>
            </select>
            <select
              className="h-10 rounded-default border border-border bg-bg-surface px-3 text-sm text-text-primary"
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value)
                setPage(1)
              }}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <Button size="sm" variant="secondary" onClick={refetchUsers} loading={usersFetching || updateQuotaLoading}>
              Refresh Users
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-default border border-border/70">
          <table className="min-w-full border-collapse">
            <thead className="bg-bg-hover/60">
              <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Access</th>
                <th className="px-3 py-2">Current Usage</th>
                <th className="px-3 py-2">Quota Settings</th>
              </tr>
            </thead>
            <tbody>
              {users.map((entry) => (
                <UserQuotaRow
                  key={entry.id}
                  user={entry}
                  onSave={handleSaveQuota}
                  onSuspend={handleSuspend}
                  onReactivate={handleReactivate}
                  onDelete={handleDelete}
                  saving={savingUserId === entry.id}
                  actionLoading={actionLoading && actingUserId === entry.id}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Page {pagination.page} of {pagination.totalPages} • {pagination.total} users</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={Number(pagination.page) <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={Number(pagination.page) >= Number(pagination.totalPages || 1)}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default AdminDashboardPage
