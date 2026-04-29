/* 
SDK Functions List and their descriptions (To start):

PASSWORD AUTHENTICATION:
- signUpWithUsernameAndPassword 
    - Registers a new user using their username and password.
    - Search DB for username to prevent duplicates.
    - Validates password strength and format.
- signUpwithEmailAndPassword
    - Registers a new user using their email and password.
    - Search DB for email to prevent duplicates.
    - Validates password strength and format.
- signInWithUsernameAndPassword
    - Authenticates a user using their username and password.
    - Verifies the username exists in the DB.
- signInWithEmailAndPassword
    - Authenticates a user using their email and password.
    - Verifies the email exists in the DB.

PASSWORDLESS AUTHENTICATION:
- signInWithEmailLink
    - Sends a magic link to the user's email for authentication.
    - Validates email. 
- more coming up soon... 

- signout
    - Logs the user out of their account.
    - Clears any session data or tokens stored on the client side.

- deleteUser
    - Deletes the user's account from the system.
    - Removes all associated data and credentials from the database.
*/