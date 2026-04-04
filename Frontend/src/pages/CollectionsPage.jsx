import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAddItemToCollectionMutation,
  useCreateCollectionMutation,
  useDeleteCollectionMutation,
  useGetCollectionQuery,
  useGetCollectionsQuery,
  useRemoveFromCollectionMutation,
  useUpdateCollectionMutation,
} from '@/app/api/collectionsApi'
import { useGetItemsQuery } from '@/app/api/itemsApi'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Input from '@/components/ui/Input'
import Skeleton from '@/components/ui/Skeleton'
import { FolderOpen, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const asList = (value, keys = ['collections', 'items', 'data', 'itemIds']) => {
  const root = value?.data || value || {}

  if (Array.isArray(root)) return root

  for (const key of keys) {
    if (Array.isArray(root?.[key])) {
      return root[key]
    }

    if (Array.isArray(root?.data?.[key])) {
      return root.data[key]
    }
  }

  return []
}

const normalizePayload = (response) => response?.data || response || {}

const getId = (value) => String(value?.id || value?._id || '')

const normalizeTag = (tag) => {
  if (typeof tag === 'string') return tag
  if (tag && typeof tag === 'object') return tag.name || tag.label || String(tag._id || '')
  return String(tag || '')
}

export function CollectionsPage() {
  const [selectedId, setSelectedId] = useState('')
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [editingName, setEditingName] = useState('')
  const [selectedItemToAdd, setSelectedItemToAdd] = useState('')

  const {
    data: collectionsRaw,
    isLoading: collectionsLoading,
    isError: collectionsError,
    error: collectionsErrorPayload,
    refetch: refetchCollections,
  } = useGetCollectionsQuery({ page: 1, limit: 100 })

  const collectionsPayload = normalizePayload(collectionsRaw)
  const collections = asList(collectionsPayload)

  useEffect(() => {
    if (!collections?.length) {
      setSelectedId('')
      return
    }

    if (!selectedId) {
      const firstId = getId(collections[0])
      if (firstId !== selectedId) {
        setSelectedId(firstId)
      }
    } else if (!collections.some((collection) => getId(collection) === selectedId)) {
      setSelectedId(getId(collections[0]))
    }
  }, [collections.length, selectedId])

  const {
    data: selectedCollectionRaw,
    isLoading: selectedLoading,
    isError: selectedError,
    error: selectedErrorPayload,
    refetch: refetchSelected,
  } = useGetCollectionQuery(selectedId, { skip: !selectedId })

  const selectedCollection = normalizePayload(selectedCollectionRaw)
  const selectedItems = asList(selectedCollection)

  useEffect(() => {
    if (selectedCollection?.name) {
      setEditingName(selectedCollection.name)
    }
  }, [selectedCollection?.name, selectedId])

  const { data: itemsRaw } = useGetItemsQuery({ limit: 100, offset: 0 })
  const availableItems = useMemo(() => {
    const allItems = asList(normalizePayload(itemsRaw))
    if (!selectedItems.length) {
      return allItems
    }

    const selectedItemIds = new Set(selectedItems.map((item) => getId(item)))
    return allItems.filter((item) => !selectedItemIds.has(getId(item)))
  }, [itemsRaw, selectedItems])

  useEffect(() => {
    if (!availableItems?.length) {
      setSelectedItemToAdd('')
      return
    }

    if (!selectedItemToAdd) {
      const firstId = getId(availableItems[0])
      if (firstId !== selectedItemToAdd) {
        setSelectedItemToAdd(firstId)
      }
    } else if (!availableItems.some((item) => getId(item) === selectedItemToAdd)) {
      setSelectedItemToAdd(getId(availableItems[0]))
    }
  }, [availableItems.length, selectedItemToAdd])

  const [createCollection, { isLoading: creatingCollection }] = useCreateCollectionMutation()
  const [updateCollection, { isLoading: updatingCollection }] = useUpdateCollectionMutation()
  const [deleteCollection, { isLoading: deletingCollection }] = useDeleteCollectionMutation()
  const [addItemToCollection, { isLoading: addingItem }] = useAddItemToCollectionMutation()
  const [removeFromCollection, { isLoading: removingItem }] = useRemoveFromCollectionMutation()

  const handleCreateCollection = async () => {
    if (!createName.trim()) {
      toast.error('Collection name is required')
      return
    }

    try {
      const response = await createCollection({
        name: createName.trim(),
        description: createDescription.trim(),
      }).unwrap()

      const created = normalizePayload(response)
      const createdId = getId(created)
      setCreateName('')
      setCreateDescription('')
      toast.success('Collection created')
      await refetchCollections()
      if (createdId) {
        setSelectedId(createdId)
      }
    } catch {
      toast.error('Could not create collection')
    }
  }

  const handleRenameCollection = async () => {
    if (!selectedId) {
      return
    }

    if (!editingName.trim()) {
      toast.error('Collection name cannot be empty')
      return
    }

    try {
      await updateCollection({ id: selectedId, name: editingName.trim() }).unwrap()
      toast.success('Collection updated')
      refetchCollections()
      refetchSelected()
    } catch {
      toast.error('Could not update collection')
    }
  }

  const handleDeleteCollection = async () => {
    if (!selectedId) {
      return
    }

    try {
      await deleteCollection(selectedId).unwrap()
      toast.success('Collection deleted')
      setSelectedId('')
      refetchCollections()
    } catch {
      toast.error('Could not delete collection')
    }
  }

  const handleAddItem = async () => {
    if (!selectedId || !selectedItemToAdd) {
      return
    }

    try {
      await addItemToCollection({ id: selectedId, itemId: selectedItemToAdd }).unwrap()
      toast.success('Item added to collection')
      refetchSelected()
    } catch {
      toast.error('Could not add item')
    }
  }

  const handleRemoveItem = async (itemId) => {
    if (!selectedId || !itemId) {
      return
    }

    try {
      await removeFromCollection({ id: selectedId, itemId }).unwrap()
      toast.success('Item removed')
      refetchSelected()
    } catch {
      toast.error('Could not remove item')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card padding="comfortable" className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Collections</h1>
          <p className="text-sm text-text-secondary">Organize saved knowledge into focused spaces.</p>
        </div>

        <div className="space-y-2 rounded-default border border-border bg-surface p-3">
          <Input
            placeholder="Collection name"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
          />
          <Input
            placeholder="Description (optional)"
            value={createDescription}
            onChange={(event) => setCreateDescription(event.target.value)}
          />
          <Button className="w-full" loading={creatingCollection} leftIcon={<Plus size={14} />} onClick={handleCreateCollection}>
            Create collection
          </Button>
        </div>

        {collectionsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : collectionsError ? (
          <ErrorState
            title="Could not load collections"
            message={collectionsErrorPayload?.data?.message || 'Please retry.'}
            onRetry={refetchCollections}
          />
        ) : collections.length ? (
          <div className="space-y-2">
            {collections.map((collection) => {
              const collectionId = getId(collection)
              const isActive = selectedId === collectionId
              const itemCount = collection?.itemCount || collection?.itemIds?.length || 0

              return (
                <button
                  key={collectionId}
                  type="button"
                  className={`focus-ring w-full rounded-default border p-3 text-left transition ${isActive ? 'border-brand/40 bg-brand-soft' : 'border-border bg-surface hover:bg-surface-2'}`}
                  onClick={() => setSelectedId(collectionId)}
                >
                  <p className="line-clamp-1 text-sm font-semibold text-text-primary">{collection?.name || 'Untitled collection'}</p>
                  <p className="mt-1 text-xs text-text-secondary">{itemCount} items</p>
                </button>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="No collections yet"
            description="Create your first collection to start grouping items."
          />
        )}
      </Card>

      <Card padding="comfortable" className="space-y-4">
        {!selectedId ? (
          <EmptyState
            icon={FolderOpen}
            title="Pick a collection"
            description="Select a collection from the left or create a new one."
          />
        ) : selectedLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : selectedError ? (
          <ErrorState
            title="Could not load collection"
            message={selectedErrorPayload?.data?.message || 'Please retry.'}
            onRetry={refetchSelected}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{selectedCollection?.name || 'Collection'}</h2>
                <p className="text-sm text-text-secondary">{selectedCollection?.description || 'No description yet.'}</p>
              </div>
              <Button variant="danger" size="sm" loading={deletingCollection} leftIcon={<Trash2 size={14} />} onClick={handleDeleteCollection}>
                Delete
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} placeholder="Rename collection" />
              <Button size="sm" loading={updatingCollection} onClick={handleRenameCollection}>
                Save name
              </Button>
            </div>

            <div className="rounded-default border border-border bg-surface p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Add item</p>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  className="focus-ring h-10 rounded-default border border-border bg-surface px-3 text-sm text-text-primary"
                  value={selectedItemToAdd}
                  onChange={(event) => setSelectedItemToAdd(event.target.value)}
                  disabled={!availableItems.length}
                >
                  {availableItems.length ? (
                    availableItems.map((item) => (
                      <option key={getId(item)} value={getId(item)}>
                        {item?.title || 'Untitled item'}
                      </option>
                    ))
                  ) : (
                    <option value="">No items available</option>
                  )}
                </select>
                <Button size="sm" loading={addingItem} onClick={handleAddItem} disabled={!selectedItemToAdd}>
                  Add
                </Button>
              </div>
            </div>

            {selectedItems.length ? (
              <ul className="space-y-2">
                {selectedItems.map((item) => {
                  const itemId = getId(item)
                  return (
                    <li key={itemId} className="flex flex-wrap items-center justify-between gap-2 rounded-default border border-border bg-surface px-3 py-2">
                      <div>
                        <Link to={`/item/${itemId}`} className="text-sm font-medium text-text-primary hover:text-brand">
                          {item?.title || 'Untitled item'}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Array.isArray(item?.tags)
                            ? item.tags.slice(0, 4).map((tag) => {
                                const normalizedTag = normalizeTag(tag)
                                return (
                                  <Badge key={String(normalizedTag)} size="sm" variant="default">
                                    {normalizedTag}
                                  </Badge>
                                )
                              })
                            : null}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={removingItem}
                        onClick={() => handleRemoveItem(itemId)}
                      >
                        Remove
                      </Button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState
                icon={FolderOpen}
                title="No items in this collection"
                description="Add items from the picker above."
              />
            )}
          </>
        )}
      </Card>
    </div>
  )
}

export default CollectionsPage
