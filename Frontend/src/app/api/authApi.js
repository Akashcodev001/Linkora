import { baseApi } from '@/app/api/baseApi'
import tokenManager from '@/lib/tokenManager'
import { logout, setCredentials } from '@/features/auth/authSlice'

const normalizePayload = (response) => response?.data || response || null

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
    }),

    login: builder.mutation({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          const payload = normalizePayload(data)
          const accessToken = payload?.accessToken || payload?.token || null
          const user = payload?.user || null

          if (accessToken) {
            tokenManager.setToken(accessToken)
          }

          dispatch(
            setCredentials({
              user,
              isAuthenticated: Boolean(user || accessToken),
            }),
          )
        } catch {
          tokenManager.clearToken()
          dispatch(logout())
        }
      },
    }),

    getMe: builder.query({
      query: () => '/auth/me',
      providesTags: ['User'],
      keepUnusedDataFor: 60,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          const payload = normalizePayload(data)
          dispatch(
            setCredentials({
              user: payload?.user || payload || null,
              isAuthenticated: true,
            }),
          )
        } catch (error) {
          const status = Number(error?.error?.status || error?.status || 0)
          if (status === 401 || status === 403) {
            tokenManager.clearToken()
            dispatch(logout())
          }
        }
      },
    }),

    logoutUser: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        tokenManager.clearToken()
        dispatch(logout())

        try {
          await queryFulfilled
        } catch {
          // keep local logout state even if server logout fails
        }
      },
    }),
  }),
  overrideExisting: false,
})

export const {
  useRegisterMutation,
  useLoginMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
  useLogoutUserMutation,
} = authApi

export default authApi
