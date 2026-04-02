import { baseApi } from '@/app/api/baseApi'

export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminOverview: builder.query({
      query: ({ windowDays = 14, topUsers = 10 } = {}) => ({
        url: '/admin/overview',
        params: { windowDays, topUsers },
      }),
      providesTags: ['Admin'],
    }),

    getAdminUsers: builder.query({
      query: ({ page = 1, limit = 25, query = '', role = 'all', status = 'active', sortBy = 'createdAt', sortOrder = 'desc' } = {}) => ({
        url: '/admin/users',
        params: { page, limit, query, role, status, sortBy, sortOrder },
      }),
      providesTags: ['Admin'],
    }),

    updateAdminUserQuota: builder.mutation({
      query: ({ userId, ...body }) => ({
        url: `/admin/users/${userId}/quota`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Admin'],
    }),

    suspendAdminUser: builder.mutation({
      query: ({ userId, reason }) => ({
        url: `/admin/users/${userId}/suspend`,
        method: 'PATCH',
        body: { reason },
      }),
      invalidatesTags: ['Admin'],
    }),

    reactivateAdminUser: builder.mutation({
      query: (userId) => ({
        url: `/admin/users/${userId}/reactivate`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Admin'],
    }),

    deleteAdminUser: builder.mutation({
      query: (userId) => ({
        url: `/admin/users/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Admin'],
    }),
  }),
  overrideExisting: false,
})

const getApiBase = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export function getAdminUsersCsvUrl(params = {}) {
  const search = new URLSearchParams(params)
  return `${getApiBase()}/admin/export/users.csv?${search.toString()}`
}

export function getAdminQuotaAuditCsvUrl(params = {}) {
  const search = new URLSearchParams(params)
  return `${getApiBase()}/admin/export/quota-audit.csv?${search.toString()}`
}

export const {
  useGetAdminOverviewQuery,
  useGetAdminUsersQuery,
  useUpdateAdminUserQuotaMutation,
  useSuspendAdminUserMutation,
  useReactivateAdminUserMutation,
  useDeleteAdminUserMutation,
} = adminApi

export default adminApi
