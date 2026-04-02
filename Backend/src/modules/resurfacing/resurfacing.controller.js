import { sendError, sendSuccess } from '../../common/helpers/response.js';
import * as resurfacingService from './resurfacing.service.js';

export async function getResurfacing(req, res) {
    try {
        const userId = req.user.id;
        const { days } = req.query;
        const result = await resurfacingService.getResurfacingFeed(userId, days);
        return sendSuccess(res, result, 'Resurfacing items fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching resurfacing items', error.statusCode || 500);
    }
}
