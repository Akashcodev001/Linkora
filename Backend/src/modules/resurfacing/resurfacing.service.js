import * as itemService from '../item/item.service.js';

export async function getResurfacingFeed(userId, days) {
    return itemService.getResurfacingService(userId, days);
}
