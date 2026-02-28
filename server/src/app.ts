import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import pinoHttp from 'pino-http';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sessionAuth } from './middleware/sessionAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser(env.cookieSecret));
app.use(pinoHttp.default({ logger }));
app.use(sessionAuth);

// Serve client build
app.use(express.static(path.join(__dirname, '../../client/dist')));

app.use('/api', routes);

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

app.use(notFound);
app.use(errorHandler);
