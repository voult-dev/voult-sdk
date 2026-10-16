import express from 'express';
import { createVoultRouter } from '@voult/express';

const app = express();
app.set('trust proxy', 1);
// Hosted OAuth and magic links come back to the one page.
app.use('/api/auth', createVoultRouter({ oauth: { successPath: '/', mfaPath: '/', errorPath: '/' } }));
app.use(express.static('public'));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`http://localhost:${port}`));
