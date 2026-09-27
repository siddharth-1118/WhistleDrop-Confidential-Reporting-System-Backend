import { Router } from 'express';
import { submitReport, trackReport } from '../controllers/reporter.controller';
import { validateBody, createReportSchema } from '../middleware/validation';

const router = Router();

// Public Anonymous Reporting Endpoints
router.post('/reports', validateBody(createReportSchema), submitReport);
router.get('/reports/track/:caseCode', trackReport);

export default router;
