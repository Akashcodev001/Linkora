import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import tokenManager from '@/lib/tokenManager'
import { logout, setCredentials, setInitialized } from '@/features/auth/authSlice'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  credentials: 'include',
  prepareHeaders: (headers) => {
    const token = tokenManager.getToken()

    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }

    return headers
  },
})

const getRequestUrl = (args) => {
  if (typeof args === 'string') {
    return args
  }

  return args?.url || ''
}

const getRefreshTokenFromResponse = (data) => {
  return data?.accessToken || data?.token || null
}

const getMethod = (args) => {
  if (typeof args === 'string') return 'GET'
  return String(args?.method || 'GET').toUpperCase()
}

const getRetryAfterMs = (result) => {
  const headerValue = result?.meta?.response?.headers?.get?.('retry-after')
  const parsed = Number(headerValue)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed * 1000
  }
  return 1200
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions)

  const requestUrl = getRequestUrl(args)
  const isRefreshRequest = requestUrl.includes('/auth/refresh')

  if (result.error?.status === 401 && !isRefreshRequest) {
    const refreshResult = await rawBaseQuery(
      {
        url: '/auth/refresh',
        method: 'POST',
      },
      api,
      extraOptions,
    )

    if (refreshResult.data) {
      const newAccessToken = getRefreshTokenFromResponse(refreshResult.data)
      const existingUser = api.getState()?.auth?.user || null

      if (newAccessToken) {
        tokenManager.setToken(newAccessToken)
      }

      if (refreshResult.data?.user || existingUser) {
        api.dispatch(
          setCredentials({
            user: refreshResult.data?.user || existingUser,
          }),
        )
      } else {
        api.dispatch(setInitialized(true))
      }

      result = await rawBaseQuery(args, api, extraOptions)
    } else {
      tokenManager.clearToken()
      api.dispatch(logout())
    }
  }

  // Gentle one-shot retry for read requests when backend asks us to slow down.
  if (result.error?.status === 429 && getMethod(args) === 'GET') {
    await sleep(getRetryAfterMs(result))
    result = await rawBaseQuery(args, api, extraOptions)
  }

  return result
}

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Items', 'Item', 'Collections', 'Collection', 'Graph', 'Search', 'Highlights', 'Resurfacing', 'User', 'Admin'],
  endpoints: () => ({}),
})

export default baseApi
