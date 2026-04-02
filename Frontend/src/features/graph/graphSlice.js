import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  nodes: [],
  links: [],
  expandedNodeIds: [],
  selectedNodeId: null,
  isLoading: false,
}

const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    setGraphData: (state, action) => {
      state.nodes = action.payload?.nodes || []
      state.links = action.payload?.links || []
    },
    setExpandedNodeIds: (state, action) => {
      state.expandedNodeIds = action.payload || []
    },
    addExpandedNodeId: (state, action) => {
      const nodeId = action.payload
      if (!nodeId) {
        return
      }
      if (!state.expandedNodeIds.includes(nodeId)) {
        state.expandedNodeIds.push(nodeId)
      }
    },
    setSelectedNodeId: (state, action) => {
      state.selectedNodeId = action.payload || null
    },
    setGraphLoading: (state, action) => {
      state.isLoading = Boolean(action.payload)
    },
    clearGraph: (state) => {
      state.nodes = []
      state.links = []
      state.expandedNodeIds = []
      state.selectedNodeId = null
      state.isLoading = false
    },
  },
})

export const {
  setGraphData,
  setExpandedNodeIds,
  addExpandedNodeId,
  setSelectedNodeId,
  setGraphLoading,
  clearGraph,
} = graphSlice.actions

export default graphSlice.reducer
