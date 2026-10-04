import { Router } from 'express';
import { submitReport, lookupReport, getReportTimeline } from '../controllers/reporter.controller';
import { validateBody, createReportSchema, lookupReportSchema } from '../middleware/validation';

const router = Router();

// Public Anonymous Reporting & Lookup Endpoints
router.post('/reports', validateBody(createReportSchema), submitReport);
router.post('/reports/lookup', validateBody(lookupReportSchema), lookupReport);
router.get('/reports/:id/timeline', getReportTimeline);

export default router;
