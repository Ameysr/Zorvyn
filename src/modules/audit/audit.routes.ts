import { Router } from 'express';
import { AuditController } from './audit.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

const router = Router();

// All audit routes require admin access
router.use(authenticate);

/**
 * @route   GET /api/v1/audit-logs
 * @desc    List all audit log entries (paginated)
 * @access  Admin only
 */
router.get('/', authorize('admin'), AuditController.list);

/**
 * @route   GET /api/v1/audit-logs/:entityId
 * @desc    Get audit history for a specific entity
 * @access  Admin only
 */
router.get('/:entityId', authorize('admin'), AuditController.getByEntity);

export default router;
