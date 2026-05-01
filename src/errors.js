/**
 * Voult SDK Error Classes
 * Custom error classes for handling various error scenarios
 */

/**
 * Base error class for all Voult SDK errors
 */
export class VoultError extends Error {
  constructor(message, code, status, details) {
    super(message);
    this.name = 'VoultError';
    this.code = code;
    this.status = status;
    this.details = details;
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends VoultError {
  constructor(message, details) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends VoultError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Error thrown when network request fails
 */
export class NetworkError extends VoultError {
  constructor(message) {
    super(message, 'NETWORK_ERROR', null);
    this.name = 'NetworkError';
  }
}

/**
 * Error thrown when user is not authorized
 */
export class AuthorizationError extends VoultError {
  constructor(message, details) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Error thrown when a conflict occurs (e.g., user already exists)
 */
export class ConflictError extends VoultError {
  constructor(message, details) {
    super(message, 'CONFLICT_ERROR', 409, details);
    this.name = 'ConflictError';
  }
}

/**
 * Error thrown when account is locked
 */
export class AccountLockedError extends VoultError {
  constructor(message, details) {
    super(message, 'ACCOUNT_LOCKED', 423, details);
    this.name = 'AccountLockedError';
  }
}