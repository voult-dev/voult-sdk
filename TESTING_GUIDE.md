# Voult SDK Testing Guide

This guide explains how to test the Voult SDK locally before publishing to npm.

## Prerequisites

Before testing, make sure you have:
1. The Voult API running locally (from the [voult repository](https://github.com/DevOlabode/voult))
2. A test application created in the Voult dashboard to get `clientId` and `clientSecret`
3. Node.js 18+ installed

## Method 1: Direct Import (Simplest)

Create a test file in the SDK directory:

```javascript
// test-manual.js
import voult, { 
  VoultClient, 
  signUpWithEmailAndPassword,
  signInWithEmailAndPassword,
  ValidationError
} from './src/index.js';

// Test configuration - update with your actual values
const CONFIG = {
  clientId: 'your-client-id',      // From your Voult app
  clientSecret: 'your-client-secret',
  baseURL: 'http://localhost:3000'  // Local API
};

async function runTests() {
  console.log('🧪 Starting Voult SDK Tests...\n');
  
  // Test 1: Initialize SDK
  console.log('Test 1: Initialize SDK');
  const auth = voult(CONFIG);
  console.log('✅ SDK initialized successfully\n');
  
  // Test 2: Validation functions
  console.log('Test 2: Validation functions');
  const { isValidEmail, isValidPassword } = await import('./src/index.js');
  console.log('  isValidEmail("test@example.com"):', isValidEmail('test@example.com'));
  console.log('  isValidPassword("StrongPass123!"):', isValidPassword('StrongPass123!'));
  console.log('✅ Validation functions work\n');
  
  // Test 3: Sign up (requires running API)
  console.log('Test 3: Sign up with email');
  try {
    const testEmail = `test+${Date.now()}@example.com`;
    const { user, token } = await signUpWithEmailAndPassword(
      testEmail,
      'StrongPass123!',
      { fullName: 'Test User' },
      auth.client
    );
    console.log('  User created:', user.email);
    console.log('✅ Sign up successful\n');
  } catch (error) {
    console.log('❌ Sign up failed:', error.message);
  }
  
  // Test 4: Sign in (requires running API)
  console.log('Test 4: Sign in with email');
  try {
    const { user, accessToken } = await signInWithEmailAndPassword(
      'existing@example.com',  // Use an email that exists in your test app
      'StrongPass123!',
      auth.client
    );
    console.log('  Logged in as:', user.email);
    console.log('✅ Sign in successful\n');
  } catch (error) {
    console.log('❌ Sign in failed:', error.message);
  }
  
  // Test 5: Error handling
  console.log('Test 5: Error handling');
  try {
    await signInWithEmailAndPassword(
      'invalid-email',
      'weak',
      auth.client
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('  Caught ValidationError:', error.message);
      console.log('✅ Error handling works\n');
    }
  }
  
  console.log('🎉 All tests completed!');
}

runTests().catch(console.error);
```

Run with:
```bash
node test-manual.js
```

## Method 2: npm link (For Testing in Another Project)

### Step 1: Create a global link

```bash
# In the voult-sdk directory
sudo npm link
```

### Step 2: Link in your test project

```bash
# In your test project directory
npm link voult-sdk
```

### Step 3: Use in your test project

```javascript
// In your test project
import voult from 'voult-sdk';

const auth = voult({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  baseURL: 'http://localhost:3000'
});

// Now you can use all auth methods
```

### Step 4: Unlink when done

```bash
# In your test project
npm unlink voult-sdk

# In the voult-sdk directory (optional)
sudo npm unlink
```

## Method 3: Local File Path Dependency

In your test project's `package.json`:

```json
{
  "dependencies": {
    "voult-sdk": "file:../voult-sdk"
  }
}
```

Then run:
```bash
npm install
```

## Method 4: Using Vitest (Automated Testing)

### Install Vitest

```bash
npm install -D vitest
```

### Create test file

```javascript
// test/sdk.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoultClient, ValidationError, isValidEmail, isValidPassword } from '../src/index.js';

describe('Voult SDK', () => {
  describe('Validation', () => {
    it('should validate email correctly', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    it('should validate password correctly', () => {
      expect(isValidPassword('StrongPass123!')).toBe(true);
      expect(isValidPassword('weak')).toBe(false);
      expect(isValidPassword('')).toBe(false);
    });
  });

  describe('VoultClient', () => {
    it('should throw error without clientId', () => {
      expect(() => new VoultClient({ clientSecret: 'secret' }))
        .toThrow(ValidationError);
    });

    it('should throw error without clientSecret', () => {
      expect(() => new VoultClient({ clientId: 'id' }))
        .toThrow(ValidationError);
    });

    it('should create client with valid config', () => {
      const client = new VoultClient({
        clientId: 'test_id',
        clientSecret: 'test_secret'
      });
      
      expect(client.clientId).toBe('test_id');
      expect(client.clientSecret).toBe('test_secret');
      expect(client.baseURL).toBe('https://api.voult.dev');
    });
  });
});
```

### Run tests

```bash
npx vitest run
```

## Method 5: Integration Testing with Mock API

Create a mock server to test without the real API:

```javascript
// test/integration.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoultClient } from '../src/index.js';

describe('Integration Tests', () => {
  let client;
  let mockFetch;

  beforeEach(() => {
    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    client = new VoultClient({
      clientId: 'test_id',
      clientSecret: 'test_secret',
      baseURL: 'http://localhost:3000'
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('should make POST request with correct headers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: '1', email: 'test@example.com' } })
    });

    await client.post('/api/auth/login', {
      email: 'test@example.com',
      password: 'password'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Client-Id': 'test_id',
          'X-Client-Secret': 'test_secret',
          'Content-Type': 'application/json'
        })
      })
    );
  });
});
```

## Testing Checklist

Before publishing, ensure:

- [ ] All validation functions work correctly
- [ ] VoultClient initializes with valid config
- [ ] VoultClient throws errors for invalid config
- [ ] Sign up function calls correct API endpoint
- [ ] Sign in function calls correct API endpoint
- [ ] Magic link functions work correctly
- [ ] Sign out clears session
- [ ] Delete user disables account and clears session
- [ ] Error handling catches and transforms API errors
- [ ] All exports are accessible from main entry point
- [ ] JSDoc comments provide correct type hints

## Common Issues & Solutions

### Issue: "Cannot find module 'voult-sdk'"
**Solution:** Make sure you're using the correct import path or have linked/installed the package.

### Issue: "Error: Client ID is required"
**Solution:** Pass `clientId` and `clientSecret` when initializing the SDK.

### Issue: "Network error"
**Solution:** Make sure the Voult API is running at the specified `baseURL`.

### Issue: "Email not verified"
**Solution:** The API requires email verification before login. Use a test email that's already verified, or implement email verification in your test flow.

## Running the Voult API Locally

To test with a real API:

1. Clone the [voult repository](https://github.com/DevOlabode/voult)
2. Install dependencies: `npm install`
3. Set up environment variables (`.env`):
   ```
   PORT=3000
   MONGODB_URI=your-mongodb-connection-string
   BASE_URL=http://localhost:3000
   ```
4. Start the server: `npm start`
5. Create a test app in the Voult dashboard to get `clientId` and `clientSecret`

## Next Steps

Once testing is complete:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Commit and push changes
4. Publish to npm: `npm publish --access public`