import { Link2, MoreHorizontal, Share2, Check, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import AiStatusBadge from '@/components/items/AiStatusBadge'
import { useCreateShareLinkMutation, useDeleteItemMutation } from '@/app/api/itemsApi'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useTheme } from '@/hooks/useTheme.jsx'

dayjs.extend(relativeTime)

const domainFromUrl = (url) => {
  if (!url) return 'linkora.local'
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return 'source'
  }
}

const normalizeTag = (tag) => {
  if (typeof tag === 'string') return tag
  if (tag && typeof tag === 'object') return tag.name || tag.label || String(tag._id || '')
  return String(tag || '')
}

export function ItemCard({ item, onOpen, onRetry, onDeleted, retrying = false }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [createShareLink] = useCreateShareLinkMutation()
  const [deleteItem, { isLoading: deleting }] = useDeleteItemMutation()
  const itemId = item?.id || item?._id
  const type = item?.type || 'text'
  const status = item?.aiStatus || item?.status || 'pending'
  const updatedAt = item?.updatedAt || item?.createdAt
  const tags = Array.isArray(item?.tags) ? item.tags.map(normalizeTag).filter(Boolean) : []

  const shellClass = isDark
    ? 'border-[color:var(--border-default)] bg-[color:var(--bg-surface)] shadow-[0_18px_36px_rgba(0,0,0,0.35)]'
    : 'border-[#ead2bc] bg-[linear-gradient(180deg,#fff9f2_0%,#fff5e9_100%)] shadow-[0_12px_28px_rgba(15,23,42,0.10),0_6px_16px_rgba(249,115,22,0.10)]'

  const previewClass = isDark
    ? 'border-border/60 bg-gradient-to-br from-brand-light to-bg-muted'
    : 'border-[#e8d7c7] bg-[linear-gradient(145deg,#fff3e3_0%,#fffaf4_100%)]'

  const panelClass = isDark ? 'bg-transparent' : 'bg-[#fffbf7]'
  const footerClass = isDark
    ? 'border-border bg-transparent'
    : 'border-[#ead8c8] bg-[#fff9f3]'
  const iconButtonClass = isDark
    ? 'border-border/70 bg-bg-surface/90 text-text-secondary'
    : 'border-[#d8dbe2] bg-white text-slate-700'
  const menuClass = isDark
    ? 'border-border/80 bg-bg-surface'
    : 'border-[#d8dbe2] bg-white'
  const domainClass = isDark ? 'text-text-muted' : 'text-slate-600'
  const titleClass = isDark ? 'text-text-primary' : 'text-slate-900'
  const summaryClass = isDark ? 'text-text-secondary' : 'text-slate-700'

  const handleShare = async (e) => {
    e.stopPropagation()
    try {
      const payload = await createShareLink(itemId).unwrap()
      const shareUrl = payload?.data?.shareUrl || payload?.shareUrl || `${window.location.origin}/item/${itemId}`
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link to clipboard')
    }
  }

  const handleDelete = async (e) => {
    e.stopPropagation()

    if (!itemId) return
    const confirmed = window.confirm('Delete this item permanently?')
    if (!confirmed) return

    try {
      await deleteItem(itemId).unwrap()
      toast.success('Item deleted')
      setMenuOpen(false)
      onDeleted?.(itemId)
    } catch (error) {
      toast.error(error?.data?.message || 'Could not delete item')
    }
  }

  return (
    <Card className={`group overflow-hidden ${shellClass}`} hover clickable onClick={() => onOpen(itemId)}>
      <div className={`relative aspect-video border-b ${previewClass}`}>
        {item?.thumbnail ? (
          <img src={item.thumbnail} alt={item?.title || 'Item thumbnail'} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center text-text-muted">
            <Link2 size={24} />
          </div>
        )}
        <Badge className="absolute left-2 top-2" size="sm" variant="default">{type}</Badge>
        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            className={`focus-ring rounded border p-1.5 backdrop-blur-sm ${copied ? 'bg-emerald-100 text-emerald-700' : iconButtonClass}`}
            onClick={handleShare}
            title="Copy share link"
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
          </button>
          <button
            type="button"
            className={`focus-ring rounded border p-1.5 backdrop-blur-sm ${iconButtonClass}`}
            aria-label="More options"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((prev) => !prev)
            }}
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen ? (
            <div
              className={`absolute right-0 top-9 z-10 min-w-[130px] rounded-default border p-1 shadow-card ${menuClass}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="focus-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-state-error transition-colors hover:bg-state-error/10"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 size={12} /> {deleting ? 'Deleting...' : 'Delete item'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={`p-3 ${panelClass}`}>
        <p className={`text-xs ${domainClass}`}>{domainFromUrl(item?.url)}</p>
        <h3 className={`mt-1 line-clamp-2 text-sm font-semibold ${titleClass}`}>{item?.title || 'Untitled item'}</h3>
        <p className={`mt-1 line-clamp-3 min-h-[52px] text-sm ${summaryClass}`}>{item?.summary || item?.description || 'No description yet.'}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={String(tag)} variant="brand" size="sm">{tag}</Badge>
          ))}
          {tags.length > 3 ? <Badge size="sm">+{tags.length - 3}</Badge> : null}
        </div>
      </div>

      <div className={`flex items-center justify-between border-t px-3 py-2 ${footerClass}`}>
        <AiStatusBadge status={status} onRetry={() => onRetry(itemId)} retrying={retrying} />
        <span className={`text-xs ${domainClass}`}>{updatedAt ? dayjs(updatedAt).fromNow() : 'just now'}</span>
      </div>
    </Card>
  )
}

export default ItemCard
