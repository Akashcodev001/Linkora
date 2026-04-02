import { baseApi } from '@/app/api/baseApi'

export const collectionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCollections: builder.query({
      query: (params = {}) => ({
        url: '/collections',
        params,
      }),
      providesTags: ['Collections'],
    }),

    createCollection: builder.mutation({
      query: (body) => ({
        url: '/collections',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Collections'],
    }),

    getCollection: builder.query({
      query: (id) => `/collections/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Collection', id }],
    }),

    updateCollection: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/collections/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, arg) => ['Collections', { type: 'Collection', id: arg.id }],
    }),

    deleteCollection: builder.mutation({
      query: (id) => ({
        url: `/collections/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Collections'],
    }),

    addItemToCollection: builder.mutation({
      query: ({ id, itemId }) => ({
        url: `/collections/${id}/items/${itemId}`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, arg) => ['Collections', { type: 'Collection', id: arg.id }, 'Items'],
    }),

    removeFromCollection: builder.mutation({
      query: ({ id, itemId }) => ({
        url: `/collections/${id}/items/${itemId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, arg) => ['Collections', { type: 'Collection', id: arg.id }, 'Items'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetCollectionsQuery,
  useLazyGetCollectionsQuery,
  useCreateCollectionMutation,
  useGetCollectionQuery,
  useLazyGetCollectionQuery,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
  useAddItemToCollectionMutation,
  useRemoveFromCollectionMutation,
} = collectionsApi

export default collectionsApi
