import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  user: null,
  isAuthenticated: false,
  isInitialized: false,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const payload = action.payload || {}
      state.user = payload.user || payload
      state.isAuthenticated = payload.isAuthenticated !== undefined ? Boolean(payload.isAuthenticated) : Boolean(state.user)
      state.isInitialized = true
    },
    logout: (state) => {
      state.user = null
      state.isAuthenticated = false
      state.isInitialized = true
    },
    setInitialized: (state, action) => {
      state.isInitialized = Boolean(action.payload)
    },
  },
})

export const { setCredentials, logout, setInitialized } = authSlice.actions

export default authSlice.reducer
