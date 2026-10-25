export const API_BASE_URL = 'https://kpl-market-api.kpl-market-dashboard.workers.dev';
export const apiUrl = path => new URL(path, API_BASE_URL || location.origin).href;
