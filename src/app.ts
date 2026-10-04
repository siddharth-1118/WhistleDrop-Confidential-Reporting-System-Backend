import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import reporterRoutes from './routes/reporter.routes';
import moderatorRoutes from './routes/moderator.routes';
import { errorHandler } from './middleware/errorHandler';
import swaggerDocument from './docs/swagger.json';

const app: Application = express();

// Security and utility middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve Static Frontend Files
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Standard API Endpoints (/api & /api/v1 compatibility)
app.use('/api', reporterRoutes);
app.use('/api/v1', reporterRoutes);

app.use('/api/moderator', moderatorRoutes);
app.use('/api/v1/moderators', moderatorRoutes);

// Root landing endpoint serves the Single-Page Web App UI
app.get('/', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

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
