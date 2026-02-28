import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './config/prisma.js';

const start = async (): Promise<void> => {
  try {
    await prisma.$connect();
    app.listen(env.port, () => {
      logger.info(`FlowTune server running on port ${env.port}`);
    });
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
};

start();
