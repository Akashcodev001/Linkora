import { configureStore } from '@reduxjs/toolkit'
import { baseApi } from '@/app/api/baseApi'
import authReducer from '@/features/auth/authSlice'
import uiReducer from '@/features/ui/uiSlice'
import graphReducer from '@/features/graph/graphSlice'
import searchReducer from '@/features/search/searchSlice'

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    ui: uiReducer,
    graph: graphReducer,
    search: searchReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  devTools: import.meta.env.DEV,
})

export default store
