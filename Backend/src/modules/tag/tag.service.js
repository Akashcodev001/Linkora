import * as tagRepository from './tag.repository.js';

/**
 * Create tag
 * @param {string} userId - User ID
 * @param {Object} tagData - Tag data
 * @returns {Promise<Object>} Created tag
 */
export async function createTagService(userId, tagData) {
    const existingTag = await tagRepository.findTagByName(tagData.name, userId);

    if (existingTag) {
        const error = new Error('Tag already exists');
        error.statusCode = 409;
        throw error;
    }

    return tagRepository.createTag({
        userId,
        ...tagData,
    });
}

/**
 * Get user tags
 * @param {string} userId - User ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Paginated tags
 */
export async function getUserTagsService(userId, options = {}) {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const [tags, total] = await Promise.all([
        tagRepository.findTagsByUser(userId, skip, limit),
        tagRepository.countTagsByUser(userId),
    ]);

    return {
        tags,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}

/**
 * Get single tag
 * @param {string} tagId - Tag ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Tag document
 */
export async function getTagService(tagId, userId) {
    const tag = await tagRepository.findTagById(tagId, userId);

    if (!tag) {
        const error = new Error('Tag not found');
        error.statusCode = 404;
        throw error;
    }

    return tag;
}

/**
 * Update tag
 * @param {string} tagId - Tag ID
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated tag
 */
export async function updateTagService(tagId, userId, updateData) {
    const tag = await tagRepository.findTagById(tagId, userId);

    if (!tag) {
        const error = new Error('Tag not found');
        error.statusCode = 404;
        throw error;
    }

    // Check if trying to rename to existing tag
    if (updateData.name && updateData.name.toLowerCase() !== tag.name) {
        const existingTag = await tagRepository.findTagByName(updateData.name, userId);
        if (existingTag) {
            const error = new Error('Tag name already exists');
            error.statusCode = 409;
            throw error;
        }
        updateData.name = updateData.name.toLowerCase();
    }

    return tagRepository.updateTag(tagId, userId, updateData);
}

/**
 * Delete tag (soft delete)
 * @param {string} tagId - Tag ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Message
 */
export async function deleteTagService(tagId, userId) {
    const tag = await tagRepository.findTagById(tagId, userId);

    if (!tag) {
        const error = new Error('Tag not found');
        error.statusCode = 404;
        throw error;
    }

    await tagRepository.softDeleteTag(tagId, userId);
    return { message: 'Tag deleted successfully' };
}

/**
 * Get or create tags (for batch operations)
 * @param {string} userId - User ID
 * @param {Array<string>} tagNames - Tag names
 * @returns {Promise<Array>} Tags
 */
export async function getOrCreateTagsService(userId, tagNames) {
    return tagRepository.getOrCreateTags(userId, tagNames);
}
