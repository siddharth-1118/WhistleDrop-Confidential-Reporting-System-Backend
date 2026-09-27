import { Router } from 'express';
import {
  moderatorLogin,
  getAllReports,
  getReportById,
  updateReportStatus,
  closeReportCase,
} from '../controllers/moderator.controller';
import { requireModeratorAuth } from '../middleware/auth';
import { validateBody, loginSchema, updateStatusSchema } from '../middleware/validation';

const router = Router();

// Public Moderator Login Endpoint
router.post('/login', validateBody(loginSchema), moderatorLogin);

// Authenticated Moderator Endpoints
router.use(requireModeratorAuth);

router.get('/reports', getAllReports);
router.get('/reports/:id', getReportById);
router.patch('/reports/:id/status', validateBody(updateStatusSchema), updateReportStatus);
router.post('/reports/:id/close', closeReportCase);

export default router;
