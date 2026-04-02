import * as itemService from '../item/item.service.js';

export async function searchBySemanticMeaning(userId, query, options = {}) {
    return itemService.searchItemsService(userId, query, options);
}
