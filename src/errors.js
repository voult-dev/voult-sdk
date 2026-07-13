/**
 * Voult SDK Error Classes
 * Custom error classes for handling various error scenarios
 */

/**
 * @typedef {Object} VoultErrorDetails
 * @property {string} [apiCode] - Error code returned by the Voult API
 * @property {unknown} [response] - Raw API error response body
 * @property {{ method: string, url: string, baseURL?: string }} [request] - Failed request metadata
 * @property {Array<{ field: string, message: string }>} [fields] - Field-level validation errors
 */

/**
 * Base error class for all Voult SDK errors
 */
export class VoultError extends Error {
  /**
   * @param {string} message
   * @param {string} code - SDK error category code
   * @param {number|null} status
   * @param {VoultErrorDetails} [details]
   */
  constructor(message, code, status, details) {
    super(message);
    this.name = 'VoultError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.apiCode = details?.apiCode;
    this.request = details?.request;
    this.fields = details?.fields;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      apiCode: this.apiCode,
      status: this.status,
      request: this.request,
      fields: this.fields,
      details: this.details,
    };
  }

  toString() {
    const parts = [`${this.name}: ${this.message}`];

    if (this.apiCode) {
      parts.push(`apiCode=${this.apiCode}`);
    }

    if (this.status != null) {
      parts.push(`status=${this.status}`);
    }

    if (this.request?.method && this.request?.url) {
      parts.push(`request=${this.request.method} ${this.request.url}`);
    }

    return parts.join(' | ');
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends VoultError {
  /**
   * @param {string} message
   * @param {VoultErrorDetails} [details]
   */
  constructor(message, details) {
    super(message, 'AUTHENTICATION_ERROR', details?.status ?? 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends VoultError {
  /**
   * @param {string} message
   * @param {string|VoultErrorDetails} [fieldOrDetails]
   * @param {VoultErrorDetails} [details]
   */
  constructor(message, fieldOrDetails, details) {
    let field;
    let resolvedDetails = details;

    if (typeof fieldOrDetails === 'string') {
      field = fieldOrDetails;
    } else if (fieldOrDetails && typeof fieldOrDetails === 'object') {
      resolvedDetails = fieldOrDetails;
      field = fieldOrDetails.fields?.[0]?.field;
    }

    super(message, 'VALIDATION_ERROR', 400, resolvedDetails);
    this.name = 'ValidationError';
    this.field = field ?? resolvedDetails?.fields?.[0]?.field;
  }
}

/**
 * Error thrown when network request fails
 */
export class NetworkError extends VoultError {
  constructor(message, details) {
    super(message, 'NETWORK_ERROR', null, details);
    this.name = 'NetworkError';
  }
}

/**
 * Error thrown when user is not authorized
 */
export class AuthorizationError extends VoultError {
  /**
   * @param {string} message
   * @param {VoultErrorDetails} [details]
   */
  constructor(message, details) {
    super(message, 'AUTHORIZATION_ERROR', details?.status ?? 403, details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Error thrown when a conflict occurs (e.g., user already exists)
 */
export class ConflictError extends VoultError {
  /**
   * @param {string} message
   * @param {VoultErrorDetails} [details]
   */
  constructor(message, details) {
    super(message, 'CONFLICT_ERROR', 409, details);
    this.name = 'ConflictError';
  }
}

/**
 * Error thrown when account is locked
 */
export class AccountLockedError extends VoultError {
  /**
   * @param {string} message
   * @param {VoultErrorDetails} [details]
   */
  constructor(message, details) {
    super(message, 'ACCOUNT_LOCKED', 423, details);
    this.name = 'AccountLockedError';
  }
}
