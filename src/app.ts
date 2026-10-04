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
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI to render inline styles/scripts
  })
);
app.use(cors());
app.use(express.json());

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Root landing endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'WhistleDrop Confidential Reporting API',
    status: 'ONLINE',
    documentation: '/api-docs',
    health: '/health',
    endpoints: {
      submitReport: 'POST /api/v1/reports',
      trackReport: 'GET /api/v1/reports/track/:caseCode',
      moderatorLogin: 'POST /api/v1/moderators/login',
      listReports: 'GET /api/v1/moderators/reports (Auth required)',
    },
  });
});

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
