// Runs in plain Node (its own process): the SDK's HTTP client must not see jsdom's XHR.
// Starts the SDK's fake Voult + a real @voult/express router, then prints the BFF port.
import express from 'express';
import { createVoultRouter } from '../../../express/src/index.js';
import { startTestServer } from '../../../voult-sdk/tests/support/test-server.js';

const voult = await startTestServer();
const app = express();
app.use('/api/auth', createVoultRouter({
  config: {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    baseURL: voult.baseURL,
    sessionSecret: 'contract-test-session-secret',
    session: { strategy: 'cookie' },
  },
}));
const bff = app.listen(0, '127.0.0.1', () => {
  process.stdout.write(`${JSON.stringify({ port: bff.address().port })}\n`);
});
process.on('SIGTERM', () => process.exit(0));
