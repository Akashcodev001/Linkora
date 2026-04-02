import { baseApi } from '@/app/api/baseApi'

const getIdFromArg = (arg) => {
  if (typeof arg === 'string') {
    return arg
  }

  return arg?.id || arg?._id || null
}

const removeItemFromDraftList = (draft, itemId) => {
  if (!itemId) {
    return
  }

  if (Array.isArray(draft)) {
    const index = draft.findIndex((item) => String(item?.id || item?._id) === String(itemId))
    if (index !== -1) {
      draft.splice(index, 1)
    }
    return
  }

  if (Array.isArray(draft?.items)) {
    const prevLength = draft.items.length
    draft.items = draft.items.filter((item) => String(item?.id || item?._id) !== String(itemId))

    if (typeof draft.total === 'number') {
      const removedCount = prevLength - draft.items.length
      draft.total = Math.max(0, draft.total - removedCount)
    }
  }
}

export const itemsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getItems: builder.query({
      query: (params = {}) => ({
        url: '/items',
        params,
      }),
      providesTags: ['Items'],
    }),

    getItem: builder.query({
      query: (id) => `/items/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Item', id }],
    }),

    getSharedItem: builder.query({
      query: (token) => `/shared/items/${token}`,
    }),

    saveItem: builder.mutation({
      query: (body) => ({
        url: '/items',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Items'],
    }),

    uploadItem: builder.mutation({
      query: (formData) => ({
        url: '/items/upload',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Items'],
    }),

    updateItem: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/items/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, arg) => ['Items', { type: 'Item', id: arg.id }],
    }),

    deleteItem: builder.mutation({
      query: (arg) => {
        const id = getIdFromArg(arg)
        return {
          url: `/items/${id}`,
          method: 'DELETE',
        }
      },
      async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
        const itemId = getIdFromArg(arg)
        const cachedArgs = baseApi.util.selectCachedArgsForQuery(getState(), 'getItems')

        const patches = cachedArgs.map((cachedArg) =>
          dispatch(
            baseApi.util.updateQueryData('getItems', cachedArg, (draft) => {
              removeItemFromDraftList(draft, itemId)
            }),
          ),
        )

        try {
          await queryFulfilled
        } catch {
          patches.forEach((patch) => patch.undo())
        }
      },
      invalidatesTags: ['Items'],
    }),

    getRelated: builder.query({
      query: (id) => `/items/${id}/related`,
    }),

    reprocessItem: builder.mutation({
      query: (arg) => {
        const id = getIdFromArg(arg)
        return {
          url: `/items/${id}/reprocess`,
          method: 'POST',
        }
      },
    }),

    createShareLink: builder.mutation({
      query: (arg) => {
        const id = getIdFromArg(arg)
        return {
          url: `/items/${id}/share`,
          method: 'POST',
        }
      },
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetItemsQuery,
  useLazyGetItemsQuery,
  useGetItemQuery,
  useGetSharedItemQuery,
  useLazyGetItemQuery,
  useSaveItemMutation,
  useUploadItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
  useGetRelatedQuery,
  useLazyGetRelatedQuery,
  useReprocessItemMutation,
  useCreateShareLinkMutation,
} = itemsApi

export default itemsApi
