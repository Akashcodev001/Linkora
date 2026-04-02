import { baseApi } from '@/app/api/baseApi'

export const healthApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getHealth: builder.query({
      query: () => ({
        url: '/health',
      }),
    }),
  }),
  overrideExisting: false,
})

export const { useGetHealthQuery } = healthApi

export default healthApi
