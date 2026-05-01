/**
 * Sign Out function for the Voult SDK
 * Handles user logout and session cleanup
 */

/**
 * Log out the current user
 * 
 * This function:
 * 1. Calls the API to invalidate all refresh tokens
 * 2. Increments the user's token version to invalidate any remaining access tokens
 * 3. Clears the local session data
 * 
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} Response confirming successful logout
 * @throws {AuthenticationError} If user is not authenticated
 * 
 * @example
 * ```js
 * await signOut(client);
 * console.log('User logged out successfully');
 * ```
 */
export async function signOut(client) {
  // Check if user is authenticated
  if (!client.isAuthenticated()) {
    // If not authenticated, just clear any residual data
    client.clearSession();
    return {
      success: true,
      message: 'User was not logged in',
    };
  }
  
  // Make API request to logout (requires authentication)
  const response = await client.post('/api/auth/logout', {}, { requireAuth: true });
  
  // Clear local session regardless of API response
  client.clearSession();
  
  return {
    success: true,
    message: response.message || 'Logged out successfully',
  };
}

/**
 * Delete the current user's account
 * 
 * This function:
 * 1. Calls the API to disable/delete the user account
 * 2. Clears the local session data
 * 
 * Note: The Voult API currently implements account disabling rather than hard deletion.
 * The account will be marked as inactive and the user will need to re-enable it to use again.
 * 
 * @param {VoultClient} client - The Voult client instance
 * @returns {Promise<Object>} Response confirming account deletion/disabling
 * @throws {AuthenticationError} If user is not authenticated
 * 
 * @example
 * ```js
 * await deleteUser(client);
 * console.log('Account deleted successfully');
 * ```
 */
export async function deleteUser(client) {
  // Check if user is authenticated
  if (!client.isAuthenticated()) {
    throw new Error('No authenticated user. Please sign in first.');
  }
  
  // Make API request to disable account (requires authentication)
  const response = await client.post('/api/user/disable', {}, { requireAuth: true });
  
  // Clear local session
  client.clearSession();
  
  return {
    success: response.success,
    message: response.message || 'Account disabled successfully',
  };
}