import { sendError, sendSuccess } from '../../common/helpers/response.js';
import * as clustersService from './clusters.service.js';

export async function getClusters(req, res) {
    try {
        const result = await clustersService.listClustersService(req.user.id);
        return sendSuccess(res, result, 'Clusters fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching clusters', error.statusCode || 500);
    }
}

export async function getCluster(req, res) {
    try {
        const result = await clustersService.getClusterService(req.user.id, req.params.clusterId);
        return sendSuccess(res, result, 'Cluster fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching cluster', error.statusCode || 500);
    }
}

export async function rebuildClusters(req, res) {
    try {
        const result = await clustersService.rebuildClustersService(req.user.id, {
            itemId: req.body?.itemId,
            reason: req.body?.reason,
        });
        return sendSuccess(res, result, 'Cluster rebuild queued', 202);
    } catch (error) {
        return sendError(res, error.message || 'Error rebuilding clusters', error.statusCode || 500);
    }
}
