const env = import.meta.env

export const CONFIG = {
  apiUrl: env.VITE_API_URL || 'http://localhost:5000',
  appName: env.VITE_APP_NAME || 'Linkora',
  appVersion: env.VITE_APP_VERSION || '1.0.0',
  pollingIntervalMs: Number(env.VITE_POLLING_INTERVAL_MS || 3000),
  graphMaxNodes: Number(env.VITE_GRAPH_MAX_NODES || 100),
  graphMinEdgeScore: Number(env.VITE_GRAPH_MIN_EDGE_SCORE || 0.75),
}

export default CONFIG
