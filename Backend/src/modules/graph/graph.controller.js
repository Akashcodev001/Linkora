import { sendError, sendSuccess } from '../../common/helpers/response.js';
import * as graphService from './graph.service.js';

function parseLimit(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export async function getGraph(req, res) {
    try {
        const graph = await graphService.getGraphService(req.user.id, {
            maxNodes: parseLimit(req.query.maxNodes),
            maxEdges: parseLimit(req.query.maxEdges),
        });
        return sendSuccess(res, graph, 'Graph fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching graph', error.statusCode || 500);
    }
}

export async function expandGraph(req, res) {
    try {
        const graph = await graphService.expandGraphService(req.user.id, {
            centralNodeId: req.query.centralNodeId,
            depth: parseLimit(req.query.depth),
            page: parseLimit(req.query.page),
            pageSize: parseLimit(req.query.pageSize),
            cursor: req.query.cursor,
        });

        return sendSuccess(res, graph, 'Graph expansion fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching graph expansion', error.statusCode || 500);
    }
}

export async function getItemGraph(req, res) {
    try {
        const graph = await graphService.getItemGraphService(req.user.id, req.params.itemId);
        return sendSuccess(res, graph, 'Item graph fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching item graph', error.statusCode || 500);
    }
}
