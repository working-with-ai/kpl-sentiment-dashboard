export const API_BASE_URL = '';
export const apiUrl = path => new URL(path, API_BASE_URL || location.origin).href;
