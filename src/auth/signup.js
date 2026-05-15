/**
 * Sign Up functions for the Voult SDK
 */

import { ENDPOINTS } from '../constants.js';
import {
  validateEmail,
  validatePassword,
  validateFullName,
  validateUsername,
} from '../utils/validation.js';
import { resolveClientArg } from '../utils/helpers.js';

/**
 * Register a new user with email and password
 * @param {string} email
 * @param {string} password
 * @param {Object} options
 * @param {string} options.fullName - Required by the Voult API
 * @param {string} [options.username]
 * @param {import('../client.js').VoultClient} client
 */
export async function signUpWithEmailAndPassword(email, password, options = {}, client) {
  const resolved = resolveClientArg(options, client);
  options = resolved.options;
  client = resolved.client;

  const normalizedEmail = validateEmail(email);
  validatePassword(password);
  const fullName = validateFullName(options.fullName);
  const username = options.username ? validateUsername(options.username) : undefined;

  const requestBody = {
    email: normalizedEmail,
    password,
    fullName,
  };

  if (username) {
    requestBody.username = username;
  }

  const response = await client.post(ENDPOINTS.REGISTER, requestBody);

  const { user, token, message } = response;

  if (token) {
    client.setSession(user, token, null);
  }

  return { user, token, message };
}

/**
 * Register a new user with username and password
 * @param {string} username
 * @param {string} password
 * @param {Object} options
 * @param {string} [options.fullName]
 * @param {string} [options.email]
 * @param {import('../client.js').VoultClient} client
 */
export async function signUpWithUsernameAndPassword(username, password, options = {}, client) {
  const resolved = resolveClientArg(options, client);
  options = resolved.options;
  client = resolved.client;

  const normalizedUsername = validateUsername(username);
  validatePassword(password);

  const fullName = options.fullName ? validateFullName(options.fullName) : undefined;
  const email = options.email ? validateEmail(options.email) : undefined;

  const requestBody = {
    username: normalizedUsername,
    password,
  };

  if (fullName) {
    requestBody.fullName = fullName;
  }

  if (email) {
    requestBody.email = email;
  }

  const response = await client.post(ENDPOINTS.USERNAME_REGISTER, requestBody);

  const { user, token, message } = response;

  if (token) {
    client.setSession(user, token, null);
  }

  return { user, token, message };
}
