import { baseApi } from '@/app/api/baseApi'

export const searchApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    search: builder.query({
      query: (params = {}) => ({
        url: '/search',
        params,
      }),
      providesTags: ['Search'],
    }),

    suggestions: builder.query({
      query: (q = '') => ({
        url: '/search/suggestions',
        params: { q },
      }),
      providesTags: ['Search'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useSearchQuery,
  useLazySearchQuery,
  useSuggestionsQuery,
  useLazySuggestionsQuery,
} = searchApi

export default searchApi
