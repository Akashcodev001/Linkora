import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  sidebarCollapsed: false,
  saveModalOpen: false,
  activeModal: null,
  toastQueue: [],
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSidebarCollapsed: (state, action) => {
      state.sidebarCollapsed = Boolean(action.payload)
    },
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    setSaveModalOpen: (state, action) => {
      state.saveModalOpen = Boolean(action.payload)
    },
    setActiveModal: (state, action) => {
      state.activeModal = action.payload || null
    },
    enqueueToast: (state, action) => {
      state.toastQueue.push(action.payload)
    },
    dequeueToast: (state) => {
      state.toastQueue.shift()
    },
    clearToasts: (state) => {
      state.toastQueue = []
    },
  },
})

export const {
  setSidebarCollapsed,
  toggleSidebarCollapsed,
  setSaveModalOpen,
  setActiveModal,
  enqueueToast,
  dequeueToast,
  clearToasts,
} = uiSlice.actions

export default uiSlice.reducer
