/**
 * VoultClient - HTTP client for the Voult Authentication API
 * Handles all API communication with proper headers, error handling, and token management
 */

import axios from 'axios';
import {
  VoultError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  AuthorizationError,
  ConflictError,
  AccountLockedError
} from './errors.js';
import { DEFAULT_BASE_URL, ENDPOINTS } from './constants.js';
import {
  parseApiErrorResponse,
  buildRequestContext,
} from './utils/apiError.js';

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

/**
 * VoultClient class for interacting with the Voult API
 */
export class VoultClient {
  /**
   * Create a new VoultClient instance
   * @param {Object} config - Configuration options
   * @param {string} config.baseURL - API base URL (defaults to https://api.voult.dev)
   * @param {string} config.clientId - Your application's client ID
   * @param {string} config.clientSecret - Your application's client secret
   * @param {string} [config.csrfToken] - CSRF token for state-changing routes
   * @param {boolean} [config.useCookies=false] - Send cookies (required for session CSRF)
   */
  constructor(config) {
    if (!config.clientId) {
      throw new ValidationError('Client ID is required', 'clientId');
    }

    if (!config.clientSecret) {
      throw new ValidationError('Client secret is required', 'clientSecret');
    }

    this.baseURL = config.baseURL || DEFAULT_BASE_URL;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.useCookies = config.useCookies === true;
    this.csrfToken = config.csrfToken || null;

    // Token storage (in memory by default for security)
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;

    // Refresh lock — prevents concurrent refresh attempts
    this._isRefreshing = false;

    // Create axios instance with default config
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
      withCredentials: this.useCookies,
    });

    // Add request interceptor to inject headers
    this.httpClient.interceptors.request.use(
      (config) => {
        config.headers['X-Client-Id'] = this.clientId;

        if (this.accessToken) {
          config.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        const method = (config.method || 'get').toLowerCase();
        if (this.csrfToken && MUTATING_METHODS.has(method)) {
          config.headers['X-CSRF-Token'] = this.csrfToken;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => this.handleError(error)
    );
  }

  /**
   * Fetch a CSRF token from the Voult API (requires session cookies).
   * @returns {Promise<string>} CSRF token
   */
  async fetchCsrfToken() {
    const response = await this.httpClient.get(ENDPOINTS.CSRF_TOKEN);
    const token = response.data?.token;

    if (!token) {
      throw new VoultError(
        'CSRF token missing from response',
        'CSRF_TOKEN_MISSING',
        response.status,
        response.data
      );
    }

    this.csrfToken = token;
    return token;
  }

  /**
   * Set the CSRF token used on state-changing requests.
   * @param {string|null} token
   */
  setCsrfToken(token) {
    this.csrfToken = token || null;
  }

  /**
   * Make an HTTP request to the Voult API
   * @private
   * @param {string} endpoint - API endpoint path
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      body,
      headers = {},
      requireAuth = false,
      params,
      includeClientSecret,
    } = options;

    const shouldIncludeSecret =
      includeClientSecret !== false && Boolean(this.clientSecret);

    if (shouldIncludeSecret) {
      headers['X-Client-Secret'] = this.clientSecret;
    }

    const config = {
      method: method.toLowerCase(),
      url: endpoint,
      headers,
    };

    if (params && typeof params === 'object') {
      config.params = params;
    }

    if (body && ['post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
      config.data = body;
    }

    const response = await this.httpClient.request(config);
    return response.data;
  }

  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint path
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint path
   * @param {Object} body - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint path
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Make a PATCH request
   * @param {string} endpoint - API endpoint path
   * @param {Object} body - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint path
   * @param {Object} body - Request body
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * Refresh the current user session using the refresh token.
   * Uses a separate axios instance to avoid triggering the response
   * interceptor and causing an infinite refresh loop.
   */
  async refreshSession() {
    if (!this.refreshToken) {
      throw new AuthenticationError('Authentication required');
    }

    // Use a separate axios instance for refresh to avoid the response
    // interceptor retry loop.
    const refreshClient = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': this.clientId,
        'X-Client-Secret': this.clientSecret,
      },
      timeout: 30000,
    });

    const response = await refreshClient.post('/api/sessions/refresh', {
      refreshToken: this.refreshToken,
    });

    const data = response.data || {};
    const { accessToken, refreshToken } = data;
    if (accessToken) {
      this.setSession(this.user, accessToken, refreshToken || this.refreshToken);
    }
    return data;
  }

  /**
   * Handle HTTP errors and convert to appropriate VoultError
   * @private
   * @param {Error} error - The axios error
   * @throws {VoultError} Appropriate error type
   */
  async handleError(error) {
    if (!error.response) {
      throw new NetworkError(
        error.code === 'ECONNREFUSED'
          ? 'Unable to connect to the Voult API. Please check your internet connection.'
          : 'Network error. Please check your connection and try again.',
        {
          apiCode: error.code || 'NETWORK_ERROR',
          request: buildRequestContext(error.config),
        }
      );
    }

    const { status, data } = error.response;
    const parsed = parseApiErrorResponse(data, status);
    const details = {
      apiCode: parsed.apiCode,
      response: parsed.response,
      request: buildRequestContext(error.config),
      status: parsed.status,
      ...(parsed.fields ? { fields: parsed.fields } : {}),
    };

    if (status === 401 && !this._isRefreshing) {
      if (this.refreshToken && parsed.apiCode !== 'ACCOUNT_LOCKED') {
        this._isRefreshing = true;
        try {
          await this.refreshSession();
          this._isRefreshing = false;
          error.config.headers['Authorization'] = `Bearer ${this.accessToken}`;
          return this.httpClient.request(error.config);
        } catch {
          this._isRefreshing = false;
          this.clearSession();
          throw new AuthenticationError('Session expired. Please sign in again.', {
            apiCode: 'SESSION_EXPIRED',
            request: buildRequestContext(error.config),
          });
        }
      }
    }

    throw this.createHttpError(status, parsed, details);
  }

  /**
   * Map parsed API errors to typed SDK errors.
   * @private
   */
  createHttpError(status, parsed, details) {
    const { apiCode, message } = parsed;

    switch (status) {
      case 400:
        return new ValidationError(message, details);

      case 401:
        if (apiCode === 'ACCOUNT_LOCKED') {
          return new AccountLockedError(message, details);
        }
        return new AuthenticationError(message, details);

      case 403:
        if (apiCode === 'EMAIL_NOT_VERIFIED') {
          return new AuthorizationError(
            message || 'Email not verified. Please verify your email before continuing.',
            details
          );
        }
        if (apiCode === 'ACCOUNT_DISABLED') {
          return new AuthorizationError(
            message || 'Account is disabled.',
            details
          );
        }
        return new AuthorizationError(message, details);

      case 409:
        return new ConflictError(message, details);

      case 423:
        return new AccountLockedError(message, details);

      default:
        return new VoultError(message, apiCode, status, details);
    }
  }

  /**
   * Set the current user session
   * @param {Object} user - User data
   * @param {string} accessToken - JWT access token
   * @param {string} refreshToken - JWT refresh token
   */
  setSession(user, accessToken, refreshToken) {
    this.user = user;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  /**
   * Clear the current user session
   */
  clearSession() {
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
    this._isRefreshing = false;
  }

  /**
   * Check if a user is currently authenticated
   * @returns {boolean} True if user is authenticated
   */
  isAuthenticated() {
    return !!this.accessToken && !!this.user;
  }

  /**
   * Get the current user
   * @returns {Object|null} Current user data or null
   */
  getCurrentUser() {
    return this.user;
  }
}