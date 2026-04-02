import { Bell, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { useAuth } from '@/hooks/useAuth'
import { useLogoutUserMutation } from '@/app/api/authApi'
import { useGetHealthQuery } from '@/app/api/healthApi'
import { useGetResurfacingQuery } from '@/app/api/resurfacingApi'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export function Topbar() {
  const [showNotifications, setShowNotifications] = useState(false)
  const [feed, setFeed] = useState([])
  const previousQueueRef = useRef(null)
  const previousWorkerRef = useRef(null)
  const previousResurfacingRef = useRef(0)
  const { user, logout } = useAuth()
  const [logoutUser, { isLoading }] = useLogoutUserMutation()
  const { data: healthData } = useGetHealthQuery(undefined, {
    pollingInterval: 20000,
    refetchOnFocus: false,
    refetchOnReconnect: true,
  })
  const { data: resurfacingData } = useGetResurfacingQuery({ days: 1 }, {
    pollingInterval: 60000,
    refetchOnFocus: false,
    refetchOnReconnect: false,
  })

  const queueCounts = healthData?.data?.aiQueue?.counts || healthData?.aiQueue?.counts || {}
  const queueTotal = Number(queueCounts.waiting || 0) + Number(queueCounts.active || 0) + Number(queueCounts.delayed || 0)
  const workerOnline = Boolean(healthData?.data?.aiQueue?.worker?.online || healthData?.aiQueue?.worker?.online)
  const resurfacingItems = resurfacingData?.data?.items || resurfacingData?.items || []

  const notifications = useMemo(() => {
    const system = [
      {
        id: 'queue_snapshot',
        message: `Queue: ${Number(queueCounts.waiting || 0)} waiting, ${Number(queueCounts.active || 0)} processing, ${Number(queueCounts.delayed || 0)} delayed`,
        type: 'info',
        time: 'live',
      },
      {
        id: 'worker_snapshot',
        message: workerOnline ? 'AI worker is online' : 'AI worker is offline',
        type: workerOnline ? 'success' : 'warning',
        time: 'live',
      },
    ]

    return [...feed, ...system].slice(0, 8)
  }, [feed, queueCounts.active, queueCounts.delayed, queueCounts.waiting, workerOnline])

  useEffect(() => {
    const now = Date.now()
    const previousQueue = previousQueueRef.current
    const previousWorker = previousWorkerRef.current
    const previousResurfacing = previousResurfacingRef.current

    if (previousQueue !== null && queueTotal !== previousQueue) {
      const wentDown = queueTotal < previousQueue
      const message = wentDown
        ? `Queue drained by ${previousQueue - queueTotal} jobs`
        : `Queue increased by ${queueTotal - previousQueue} jobs`

      setFeed((prev) => [
        {
          id: `queue-${now}`,
          message,
          type: wentDown ? 'success' : 'info',
          time: dayjs(now).fromNow(),
        },
        ...prev,
      ].slice(0, 6))
    }

    if (previousWorker !== null && workerOnline !== previousWorker) {
      setFeed((prev) => [
        {
          id: `worker-${now}`,
          message: workerOnline ? 'AI worker reconnected' : 'AI worker disconnected',
          type: workerOnline ? 'success' : 'warning',
          time: dayjs(now).fromNow(),
        },
        ...prev,
      ].slice(0, 6))
    }

    if (previousResurfacing !== null && resurfacingItems.length > previousResurfacing) {
      const delta = resurfacingItems.length - previousResurfacing
      setFeed((prev) => [
        {
          id: `resurface-${now}`,
          message: `${delta} new resurfacing item${delta > 1 ? 's' : ''} available`,
          type: 'info',
          time: dayjs(now).fromNow(),
        },
        ...prev,
      ].slice(0, 6))
    }

    previousQueueRef.current = queueTotal
    previousWorkerRef.current = workerOnline
    previousResurfacingRef.current = resurfacingItems.length
  }, [queueTotal, resurfacingItems.length, workerOnline])

  const handleLogout = async () => {
    try {
      await logoutUser().unwrap()
    } catch {
      // local logout still clears sensitive state
    }

    logout()
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-bg-surface/85 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 justify-end">
        <div className="relative">
          <button 
            className="focus-ring ml-auto rounded-full border border-border p-2 text-text-secondary hover:bg-bg-hover"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
          >
            <Bell size={16} />
            {notifications.length > 0 && (
              <span className="absolute right-0 top-0 flex h-3 w-3 items-center justify-center rounded-full bg-state-error text-[8px] text-white"></span>
            )}
          </button>
          {showNotifications && (
            <Card className="absolute right-0 top-12 w-80 space-y-2 p-3 shadow-floating">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Notifications</h3>
                <button onClick={() => setShowNotifications(false)} className="text-text-secondary hover:text-text-primary">
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div key={notif.id} className="rounded-default border border-border/60 bg-bg-hover/70 p-2 text-xs">
                      <p className="text-text-primary">{notif.message}</p>
                      <p className="text-text-muted">{notif.time}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-sm text-text-muted">No notifications</p>
                )}
              </div>
            </Card>
          )}
        </div>
        <div className="hidden text-right md:block">
          <p className="text-xs text-text-muted">Signed in as</p>
          <p className="text-sm font-medium text-text-primary">{user?.username || user?.email || 'User'}</p>
        </div>
        <AnimatedThemeToggler />
        <Avatar fallback="LK" />
        <Button variant="ghost" size="sm" onClick={handleLogout} loading={isLoading}>
          Logout
        </Button>
      </div>
    </header>
  )
}

export default Topbar
