/**
 * ApiService
 * Thin wrapper around the AgriAI backend HTTP API.
 *
 * The base URL can be overridden via the EXPO_PUBLIC_AGRIAI_API_URL env var,
 * which Expo exposes to JavaScript at build time.
 */
const DEFAULT_BASE_URL = 'https://urr6s98icd.execute-api.eu-west-1.amazonaws.com';
const BASE_URL =
  (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_AGRIAI_API_URL) ||
  DEFAULT_BASE_URL;

const DEFAULT_TIMEOUT_MS = 15000;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message = data?.detail || `Request failed with status ${response.status}`;
      throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Network request timed out. Check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const ApiService = {
  baseUrl: BASE_URL,

  predictYield(farmData) {
    return request('/predict', {
      method: 'POST',
      body: JSON.stringify(farmData),
    });
  },

  getRegions() {
    return request('/regions');
  },

  getCrops() {
    return request('/crops');
  },

  getCurrentSeason() {
    return request('/seasons/current');
  },

  getRegionalSummary() {
    return request('/insights/regional-summary');
  },

  getHistory(limit = 50) {
    return request(`/history?limit=${encodeURIComponent(limit)}`);
  },
};

export default ApiService;
