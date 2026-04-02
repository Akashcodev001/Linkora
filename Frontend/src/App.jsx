import { useState } from 'react'
import {
  AlertCircle,
  Bell,
  Boxes,
  Brain,
  ChevronDown,
  Folder,
  Info,
  Link,
  Plus,
  Sparkles,
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Dialog from '@/components/ui/Dialog'
import Drawer from '@/components/ui/Drawer'
import DropdownMenu, { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/DropdownMenu'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Input from '@/components/ui/Input'
import Popover from '@/components/ui/Popover'
import Separator from '@/components/ui/Separator'
import Skeleton from '@/components/ui/Skeleton'
import Spinner from '@/components/ui/Spinner'
import Switch from '@/components/ui/Switch'
import Textarea from '@/components/ui/Textarea'
import Tooltip from '@/components/ui/Tooltip'

const App = () => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [loadingBtn, setLoadingBtn] = useState(false)

  const handleSimulateLoading = () => {
    setLoadingBtn(true)
    window.setTimeout(() => setLoadingBtn(false), 900)
  }

  return (
    <main className="min-h-screen bg-bg-surface p-6 text-text-primary" aria-label="app-root">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Linkora UI Primitives</h1>
            <p className="text-sm text-text-secondary">Step 5 visual sandbox for component states and interactions.</p>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content="Notifications">
              <button className="focus-ring rounded-full border border-border bg-white p-2 text-text-secondary hover:bg-bg-hover" aria-label="Notifications">
                <Bell size={16} />
              </button>
            </Tooltip>
            <Avatar fallback="LK" />
          </div>
        </header>

        <Card className="space-y-4" padding="comfortable">
          <h2 className="text-lg font-semibold">Buttons and Badges</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" leftIcon={<Plus size={14} />}>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" loading={loadingBtn} onClick={handleSimulateLoading}>Loading</Button>
            <Button variant="secondary" disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="brand" showDot>Brand</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error" removable onRemove={() => {}}>Error</Badge>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="space-y-4" padding="comfortable">
            <h2 className="text-lg font-semibold">Inputs</h2>
            <Input placeholder="Search in Linkora..." leftIcon={<Link size={14} />} />
            <Input placeholder="Error example" error="This field is required" />
            <Textarea placeholder="Write your notes..." />
          </Card>

          <Card className="space-y-4" padding="comfortable">
            <h2 className="text-lg font-semibold">Loaders and Skeletons</h2>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Spinner /> Processing item...
            </div>
            <Skeleton variant="text" className="w-2/3" />
            <Skeleton variant="rect" className="h-20" />
            <Skeleton variant="circle" className="h-12 w-12" />
          </Card>
        </div>

        <Card className="space-y-4" padding="comfortable">
          <h2 className="text-lg font-semibold">Interactive Primitives</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Dialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              title="Create New Item"
              description="This modal validates open and close animations."
              trigger={<Button>Open Dialog</Button>}
              footer={
                <>
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => setDialogOpen(false)}>Save</Button>
                </>
              }
            >
              <Input placeholder="Item title" />
            </Dialog>

            <Drawer
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
              title="Node Preview"
              trigger={<Button variant="secondary">Open Drawer</Button>}
            >
              <p className="text-sm text-text-secondary">Drawer content region with right slide animation.</p>
            </Drawer>

            <Popover
              open={popoverOpen}
              onOpenChange={setPopoverOpen}
              trigger={<Button variant="ghost" rightIcon={<ChevronDown size={14} />}>Open Popover</Button>}
            >
              <p className="text-sm text-text-secondary">Use this for compact settings or quick actions.</p>
            </Popover>

            <DropdownMenu
              trigger={<Button variant="secondary" rightIcon={<ChevronDown size={14} />}>Menu</Button>}
            >
              <DropdownMenuItem>Profile Settings</DropdownMenuItem>
              <DropdownMenuItem>Keyboard Shortcuts</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-state-error">Sign Out</DropdownMenuItem>
            </DropdownMenu>

            <div className="flex items-center gap-2 rounded-default border border-border bg-white px-3 py-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable feature" />
              <span className="text-sm text-text-secondary">Feature {enabled ? 'On' : 'Off'}</span>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <EmptyState
            icon={Folder}
            title="No collections yet"
            description="Create your first collection to organize saved knowledge."
            ctaLabel="Create Collection"
            onCtaClick={() => {}}
          />
          <ErrorState
            message="Could not fetch graph data. Please retry."
            onRetry={() => {}}
          />
        </div>

        <Card padding="comfortable" className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Brain size={16} />
            Status Chips
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand" showDot><Sparkles size={12} /> AI Pending</Badge>
            <Badge variant="success" showDot><Info size={12} /> Processed</Badge>
            <Badge variant="warning" showDot><AlertCircle size={12} /> Attention</Badge>
            <Badge variant="default" showDot><Boxes size={12} /> 24 items</Badge>
          </div>
        </Card>
      </div>
    </main>
  )
}

export default App
