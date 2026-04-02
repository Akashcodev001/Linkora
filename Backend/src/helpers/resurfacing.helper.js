/**
 * Resurfacing helper - Return items from past dates
 * Use case: Surface older saved items to prevent them from being lost
 */

import Item from '../../models/item.model.js';

/**
 * Get items from 7 days ago
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Items from 7 days ago
 */
export async function getItemsFromSevenDaysAgo(userId) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const startOfDay = new Date(sevenDaysAgo);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(sevenDaysAgo);
    endOfDay.setHours(23, 59, 59, 999);

    return Item.find({
        userId,
        isDeleted: false,
        createdAt: {
            $gte: startOfDay,
            $lte: endOfDay,
        },
    })
        .lean();
}

/**
 * Get items from 30 days ago
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Items from 30 days ago
 */
export async function getItemsFromThirtyDaysAgo(userId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startOfDay = new Date(thirtyDaysAgo);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(thirtyDaysAgo);
    endOfDay.setHours(23, 59, 59, 999);

    return Item.find({
        userId,
        isDeleted: false,
        createdAt: {
            $gte: startOfDay,
            $lte: endOfDay,
        },
    })
        .lean();
}

/**
 * Get items from a custom date range
 * @param {string} userId - User ID
 * @param {number} daysBack - Number of days back from today
 * @returns {Promise<Array>} Items from that date
 */
export async function getItemsFromDaysBack(userId, daysBack) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysBack);

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return Item.find({
        userId,
        isDeleted: false,
        createdAt: {
            $gte: startOfDay,
            $lte: endOfDay,
        },
    })
        .lean();
}

/**
 * Get resurfacing item for today based on date cycling
 * Cycles through items, showing items that were saved N days ago (rotates weekly, biweekly, monthly)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Random item from cycle or null
 */
export async function getResurfacingItemForToday(userId) {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);

    // Cycle pattern: 7, 14, 30 days
    // This creates a predictable but rotating resurfacing schedule
    const cycles = [7, 14, 30];
    const cycleIndex = dayOfYear % 3;
    const daysBack = cycles[cycleIndex];

    const items = await getItemsFromDaysBack(userId, daysBack);

    if (items.length === 0) return null;

    // Return deterministic item based on day (same item each time for this date)
    const itemIndex = dayOfYear % items.length;
    return items[itemIndex] || null;
}
