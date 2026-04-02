import { baseApi } from '@/app/api/baseApi'

export const resurfacingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getResurfacing: builder.query({
      query: (params = {}) => ({
        url: '/resurfacing',
        params,
      }),
      providesTags: ['Resurfacing'],
    }),

    dismissItem: builder.mutation({
      query: (id) => ({
        url: `/resurfacing/${id}/dismiss`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Resurfacing'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetResurfacingQuery,
  useLazyGetResurfacingQuery,
  useDismissItemMutation,
} = resurfacingApi

export default resurfacingApi
