import { Router } from 'express';
import {
  moderatorLogin,
  getModeratorReports,
  getModeratorReportById,
  updateReportStatus,
  addReportNote,
  getAuditLogs,
} from '../controllers/moderator.controller';
import { requireModeratorAuth } from '../middleware/auth';
import { validateBody, loginSchema, updateStatusSchema, addNoteSchema } from '../middleware/validation';

const router = Router();

// Public Moderator Login Endpoint
router.post('/login', validateBody(loginSchema), moderatorLogin);

// Authenticated Moderator Endpoints
router.use(requireModeratorAuth);

router.get('/reports', getModeratorReports);
router.get('/reports/:id', getModeratorReportById);
router.patch('/reports/:id/status', validateBody(updateStatusSchema), updateReportStatus);
router.post('/reports/:id/notes', validateBody(addNoteSchema), addReportNote);
router.get('/audit', getAuditLogs);

export default router;
