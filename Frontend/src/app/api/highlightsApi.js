import { baseApi } from '@/app/api/baseApi'

export const highlightsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getHighlights: builder.query({
      query: (itemId) => ({
        url: `/highlights/item/${itemId}`,
      }),
      providesTags: ['Highlights'],
    }),

    createHighlight: builder.mutation({
      query: (body) => ({
        url: '/highlights',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Highlights'],
    }),

    updateHighlight: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/highlights/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Highlights'],
    }),

    deleteHighlight: builder.mutation({
      query: (id) => ({
        url: `/highlights/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Highlights'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetHighlightsQuery,
  useLazyGetHighlightsQuery,
  useCreateHighlightMutation,
  useUpdateHighlightMutation,
  useDeleteHighlightMutation,
} = highlightsApi

export default highlightsApi
