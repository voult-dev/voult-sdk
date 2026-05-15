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
import { DEFAULT_BASE_URL } from './constants.js';

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
      timeout: 30000, // 30 second timeout
    });

    // Add request interceptor to inject headers
    this.httpClient.interceptors.request.use(
      (config) => {
        // Always include client ID
        config.headers['X-Client-Id'] = this.clientId;

        // Include access token if available
        if (this.accessToken) {
          config.headers['Authorization'] = `Bearer ${this.accessToken}`;
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
      includeClientSecret !== false &&
      !this.accessToken &&
      !requireAuth;

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
    // Network error (no response)
    if (!error.response) {
      throw new NetworkError(
        error.code === 'ECONNREFUSED'
          ? 'Unable to connect to the Voult API. Please check your internet connection.'
          : 'Network error. Please check your connection and try again.'
      );
    }

    const { status, data } = error.response;
    const errorCode = data?.code || data?.error || 'UNKNOWN_ERROR';
    const message = data?.message || data?.error || 'An unexpected error occurred';

    // If access token expired, attempt a single token refresh then retry.
    // _isRefreshing prevents concurrent/recursive refresh calls.
    if (status === 401 && !this._isRefreshing) {
      if (this.refreshToken) {
        this._isRefreshing = true;
        try {
          await this.refreshSession();
          this._isRefreshing = false;
          // Inject the new token into the original failed request and retry
          error.config.headers['Authorization'] = `Bearer ${this.accessToken}`;
          return this.httpClient.request(error.config);
        } catch (e) {
          this._isRefreshing = false;
          // Refresh failed — clear everything so the app knows to re-login
          this.clearSession();
          throw new AuthenticationError('Session expired. Please sign in again.');
        }
      }
    }

    // Map HTTP status codes to specific error types
    switch (status) {
      case 400:
        throw new ValidationError(message);

      case 401:
        if (errorCode === 'ACCOUNT_LOCKED') {
          throw new AccountLockedError(message);
        }
        throw new AuthenticationError(message);

      case 403:
        if (errorCode === 'EMAIL_NOT_VERIFIED') {
          throw new AuthorizationError('Email not verified. Please verify your email before continuing.');
        }
        throw new AuthorizationError(message);

      case 409:
        throw new ConflictError(message);

      case 423:
        throw new AccountLockedError(message);

      case 404:
      case 500:
      case 502:
      case 503:
        throw new VoultError(message, errorCode, status, data);

      default:
        throw new VoultError(message, errorCode, status, data);
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