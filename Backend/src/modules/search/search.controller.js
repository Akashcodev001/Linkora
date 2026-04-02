import { sendError, sendSuccess } from '../../common/helpers/response.js';
import * as searchService from './search.service.js';

export async function search(req, res) {
    try {
        const userId = req.user.id;
        const { q = '', page = 1, limit = 20 } = req.query;

        if (!String(q).trim()) {
            return sendError(res, 'Search query is required', 400);
        }

        const result = await searchService.searchBySemanticMeaning(userId, q, {
            page: Number(page),
            limit: Number(limit),
        });

        return sendSuccess(res, result, 'Search completed successfully');
    } catch (error) {
        return sendError(res, error.message || 'Search failed', error.statusCode || 500);
    }
}
