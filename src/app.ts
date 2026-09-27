import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import reporterRoutes from './routes/reporter.routes';
import moderatorRoutes from './routes/moderator.routes';
import { errorHandler } from './middleware/errorHandler';
import swaggerDocument from './docs/swagger.json';

const app: Application = express();

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API Routes
app.use('/api/v1', reporterRoutes);
app.use('/api/v1/moderators', moderatorRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'WhistleDrop Confidential Reporting API',
    timestamp: new Date().toISOString(),
  });
});

// Central Error Handler
app.use(errorHandler);

export default app;
