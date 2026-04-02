import { useMemo, useState } from 'react'
import { FileUp, Link2, Type } from 'lucide-react'
import { motion } from 'framer-motion'
import Dialog from '@/components/ui/Dialog'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import Highlighter from '@/components/ui/Highlighter'
import { useSaveItemMutation, useUploadItemMutation } from '@/app/api/itemsApi'

const tabs = [
  { id: 'url', label: 'URL', icon: Link2 },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'file', label: 'File', icon: FileUp },
]

const isValidUrl = (value) => {
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

export function SaveModal({ open, onOpenChange, onSaved }) {
  const [activeTab, setActiveTab] = useState('url')
  const [url, setUrl] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [file, setFile] = useState(null)
  const [tagsInput, setTagsInput] = useState('')
  const [formError, setFormError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saveItem, { isLoading: savingItem }] = useSaveItemMutation()
  const [uploadItem, { isLoading: uploadingFile }] = useUploadItemMutation()

  const tags = useMemo(() => {
    return tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }, [tagsInput])

  const submitting = savingItem || uploadingFile

  const urlPreview = useMemo(() => {
    if (!isValidUrl(url)) {
      return null
    }

    const hostname = new URL(url).hostname.replace('www.', '')
    return {
      title: hostname,
      description: `Preview available for ${hostname}`,
    }
  }, [url])

  const reset = () => {
    setUrl('')
    setNoteTitle('')
    setTextContent('')
    setFile(null)
    setTagsInput('')
    setFormError('')
  }

  const handleSave = async () => {
    setFormError('')

    try {
      if (activeTab === 'url') {
        if (!isValidUrl(url)) {
          setFormError('Please enter a valid URL.')
          return
        }

        const response = await saveItem({
          type: 'url',
          title: urlPreview?.title || 'Saved link',
          url,
          tags,
        }).unwrap()

        onSaved(response?.data || response)
      } else if (activeTab === 'text') {
        if (!textContent.trim()) {
          setFormError('Please enter note content.')
          return
        }

        const response = await saveItem({
          type: 'text',
          title: noteTitle || 'Quick note',
          content: textContent,
          tags,
        }).unwrap()

        onSaved(response?.data || response)
      } else {
        if (!file) {
          setFormError('Please choose a file first.')
          return
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', noteTitle || file.name)
        formData.append('tags', tags.join(','))

        const response = await uploadItem(formData).unwrap()
        onSaved(response?.data || response)
      }

      reset()
      onOpenChange(false)
    } catch (error) {
      setFormError(error?.data?.message || 'Could not save item. Please try again.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span>
          Save to{' '}
          <Highlighter action="underline" color="#FF9800" animationDuration={800} iterations={1} isView>
            Linkora
          </Highlighter>
        </span>
      }
      description="Capture links, notes, and files quickly."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={submitting}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                className={`focus-ring inline-flex items-center gap-1 rounded-sm px-2 py-1 text-sm ${active ? 'border-b-2 border-brand text-brand-dark' : 'text-text-secondary hover:text-text-primary'}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {activeTab === 'url' ? (
          <div className="space-y-3">
            <Input
              placeholder="https://example.com/article"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                setPreviewLoading(Boolean(event.target.value.trim()))
                window.setTimeout(() => setPreviewLoading(false), 350)
              }}
            />
            {previewLoading ? (
              <div className="rounded-default border border-border p-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-2 h-3 w-5/6" />
              </div>
            ) : urlPreview ? (
               <motion.div
                 initial={{ opacity: 0, y: 4 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="rounded-default border border-border p-3"
               >
                 <p className="text-sm font-medium text-text-primary">{urlPreview.title}</p>
                 <p className="mt-1 text-xs text-text-secondary">{urlPreview.description}</p>
               </motion.div>
             ) : null}
           </div>
         ) : null}

         {activeTab === 'text' ? (
           <div className="space-y-3">
             <Input placeholder="Title (optional)" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
             <Textarea placeholder="Write your note..." rows={6} value={textContent} onChange={(event) => setTextContent(event.target.value)} />
           </div>
         ) : null}

         {activeTab === 'file' ? (
           <div className="space-y-3">
             <Input placeholder="File title (optional)" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
             <label className="block cursor-pointer rounded-default border border-dashed border-border bg-bg-surface p-6 text-center">
               <p className="text-sm text-text-secondary">Drop PDF or image here, or click to browse</p>
               <p className="mt-1 text-xs text-text-muted">Max 10MB</p>
               <input
                 type="file"
                 className="hidden"
                 accept="application/pdf,image/png,image/jpeg,image/webp"
                 onChange={(event) => setFile(event.target.files?.[0] || null)}
               />
             </label>
             {file ? (
               <div className="rounded-default border border-border bg-bg-surface px-3 py-2 text-sm text-text-secondary">
                 {file.name} • {Math.ceil(file.size / 1024)} KB
               </div>
             ) : null}
           </div>
         ) : null}

        <div className="space-y-2">
          <Input
            placeholder="Tags (comma separated)"
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
          />
          {tags.length ? (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="brand" size="sm">{tag}</Badge>
              ))}
            </div>
          ) : null}
        </div>

        {formError ? <p className="text-sm text-state-error">{formError}</p> : null}
      </div>
    </Dialog>
  )
}

export default SaveModal
