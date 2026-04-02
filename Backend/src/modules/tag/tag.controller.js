import * as tagService from './tag.service.js';
import { sendSuccess, sendError } from '../../common/helpers/response.js';

/**
 * Create tag
 * @route POST /api/tags
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function createTag(req, res) {
    try {
        const userId = req.user.id;
        const { name } = req.body;

        if (!name) {
            return sendError(res, 'Tag name is required', 400);
        }

        const tag = await tagService.createTagService(userId, {
            name: name.toLowerCase(),
        });

        return sendSuccess(res, tag, 'Tag created successfully', 201);
    } catch (error) {
        return sendError(res, error.message || 'Error creating tag', error.statusCode || 500);
    }
}

/**
 * Get user tags
 * @route GET /api/tags
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function getTags(req, res) {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 50 } = req.query;

        const result = await tagService.getUserTagsService(userId, {
            page: parseInt(page),
            limit: parseInt(limit),
        });

        return sendSuccess(res, result, 'Tags fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching tags', error.statusCode || 500);
    }
}

/**
 * Get single tag
 * @route GET /api/tags/:id
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function getTag(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const tag = await tagService.getTagService(id, userId);

        return sendSuccess(res, tag, 'Tag fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching tag', error.statusCode || 500);
    }
}

/**
 * Update tag
 * @route PATCH /api/tags/:id
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function updateTag(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const updateData = req.body;

        const tag = await tagService.updateTagService(id, userId, updateData);

        return sendSuccess(res, tag, 'Tag updated successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error updating tag', error.statusCode || 500);
    }
}

/**
 * Delete tag
 * @route DELETE /api/tags/:id
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function deleteTag(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await tagService.deleteTagService(id, userId);

        return sendSuccess(res, null, 'Tag deleted successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error deleting tag', error.statusCode || 500);
    }
}
