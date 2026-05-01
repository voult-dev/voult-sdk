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

/**
 * Default API base URL
 */
const DEFAULT_BASE_URL = 'https://api.voult.dev';

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
    const { method = 'GET', body, headers = {}, requireAuth = false } = options;
    
    // Add client secret for non-OAuth routes when not using user auth
    if (!this.accessToken && !requireAuth) {
      headers['X-Client-Secret'] = this.clientSecret;
    }
    
    const config = {
      method: method.toLowerCase(),
      url: endpoint,
      headers,
    };
    
    if (body && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
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
   * Handle HTTP errors and convert to appropriate VoultError
   * @private
   * @param {Error} error - The axios error
   * @throws {VoultError} Appropriate error type
   */
  handleError(error) {
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
        throw new VoultError(
          message,
          errorCode,
          status,
          data
        );
        
      default:
        throw new VoultError(
          message,
          errorCode,
          status,
          data
        );
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