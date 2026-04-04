import { baseApi } from '@/app/api/baseApi'

export const clustersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getClusters: builder.query({
      query: () => ({
        url: '/clusters',
      }),
      providesTags: ['Clusters'],
    }),

    getCluster: builder.query({
      query: (clusterId) => ({
        url: `/clusters/${clusterId}`,
      }),
      providesTags: (_result, _error, clusterId) => [{ type: 'Cluster', id: clusterId }],
    }),

    rebuildClusters: builder.mutation({
      query: (body = {}) => ({
        url: '/clusters/rebuild',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Clusters'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetClustersQuery,
  useLazyGetClustersQuery,
  useGetClusterQuery,
  useLazyGetClusterQuery,
  useRebuildClustersMutation,
} = clustersApi

export default clustersApi
