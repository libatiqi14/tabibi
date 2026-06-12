import { useEffect, useState } from 'react'
import {
  getMyNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  type Notification,
} from '../../services/notifications'

const notificationDateFormatter = new Intl.DateTimeFormat('ar-MA', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

type NotificationsPanelProps = {
  onUnreadCountChange?: (count: number) => void
}

export default function NotificationsPanel({
  onUnreadCountChange,
}: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const fetchNotifications = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const [notificationList, unreadCount] = await Promise.all([
          getMyNotifications(),
          getUnreadNotificationsCount(),
        ])

        if (isMounted) {
          setNotifications(notificationList)
          onUnreadCountChange?.(unreadCount)
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error
              ? error.message
              : 'تعذر تحميل الإشعارات. يرجى المحاولة مرة أخرى.'
          setErrorMessage(message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void fetchNotifications()

    return () => {
      isMounted = false
    }
  }, [onUnreadCountChange])

  const handleMarkAsRead = async (id: string) => {
    setUpdatingId(id)
    setErrorMessage('')

    try {
      const updatedNotification = await markNotificationAsRead(id)

      setNotifications((currentNotifications) => {
        const nextNotifications = currentNotifications.map((notification) =>
          notification.id === id ? updatedNotification : notification,
        )

        onUnreadCountChange?.(
          nextNotifications.filter((notification) => !notification.read).length,
        )

        return nextNotifications
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحديث الإشعار. يرجى المحاولة مرة أخرى.'
      setErrorMessage(message)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-normal text-slate-950">
            الإشعارات
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            آخر تحديثات المواعيد من الطبيب.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
          {notifications.filter((notification) => !notification.read).length} غير مقروء
        </span>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-7 text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-5 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
          جاري تحميل الإشعارات...
        </p>
      ) : notifications.length > 0 ? (
        <div className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`p-4 transition ${
                notification.read ? 'bg-white' : 'bg-teal-50/70'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {!notification.read ? (
                      <span className="inline-flex rounded-full bg-teal-700 px-2.5 py-1 text-xs font-bold text-white">
                        جديد
                      </span>
                    ) : null}
                    <h3 className="text-sm font-bold text-slate-950">
                      {notification.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {notification.message}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {notificationDateFormatter.format(
                      new Date(notification.created_at),
                    )}
                  </p>
                </div>

                {!notification.read ? (
                  <button
                    type="button"
                    onClick={() => handleMarkAsRead(notification.id)}
                    disabled={updatingId === notification.id}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-white px-4 text-xs font-bold text-teal-800 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updatingId === notification.id
                      ? 'جاري التحديث...'
                      : 'تعيين كمقروء'}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-lg bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
          لا توجد إشعارات
        </p>
      )}
    </section>
  )
}
