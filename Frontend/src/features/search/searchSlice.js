import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  query: '',
  filters: {
    type: null,
    tags: [],
    dateRange: null,
    collectionId: null,
  },
  page: 1,
  resultsPerPage: 20,
}

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setQuery: (state, action) => {
      state.query = action.payload || ''
      state.page = 1
    },
    setFilters: (state, action) => {
      state.filters = {
        ...state.filters,
        ...(action.payload || {}),
      }
      state.page = 1
    },
    resetFilters: (state) => {
      state.filters = initialState.filters
      state.page = 1
    },
    setPage: (state, action) => {
      state.page = Number(action.payload) || 1
    },
    setResultsPerPage: (state, action) => {
      state.resultsPerPage = Number(action.payload) || 20
    },
    resetSearch: () => initialState,
  },
})

export const {
  setQuery,
  setFilters,
  resetFilters,
  setPage,
  setResultsPerPage,
  resetSearch,
} = searchSlice.actions

export default searchSlice.reducer
