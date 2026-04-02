import { baseApi } from '@/app/api/baseApi'

export const graphApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getGraph: builder.query({
      query: ({ maxNodes = 100, maxEdges = 800 } = {}) => ({
        url: '/graph',
        params: { maxNodes, maxEdges },
      }),
      providesTags: ['Graph'],
    }),

    expandGraph: builder.query({
      query: ({ centralNodeId, depth = 1, pageSize = 50, cursor } = {}) => ({
        url: '/graph/expand',
        params: { centralNodeId, depth, pageSize, cursor },
      }),
      providesTags: ['Graph'],
    }),

    getNeighbors: builder.query({
      query: (id) => `/graph/${id}/neighbors`,
      providesTags: ['Graph'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetGraphQuery,
  useLazyGetGraphQuery,
  useExpandGraphQuery,
  useLazyExpandGraphQuery,
  useGetNeighborsQuery,
  useLazyGetNeighborsQuery,
} = graphApi

export default graphApi
