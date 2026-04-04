import { Router } from 'express';
import { RecordController } from './record.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { scopeFilter } from '../../middleware/scopeFilter.js';
import { validate } from '../../middleware/validator.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import {
  createRecordSchema,
  updateRecordSchema,
  recordIdParamSchema,
  listRecordsQuerySchema,
} from './record.validator.js';

const router = Router();

// All routes require authentication + scope filtering
router.use(authenticate, scopeFilter);

/**
 * @route   POST /api/v1/records
 * @desc    Create a financial record
 * @access  Admin only (with idempotency support)
 */
router.post(
  '/',
  authorize('admin'),
  idempotencyMiddleware,
  validate(createRecordSchema),
  RecordController.create
);

/**
 * @route   GET /api/v1/records/export
 * @desc    Export financial records as CSV
 * @access  Analyst, Admin (scoped to department)
 */
router.get(
  '/export',
  authorize('analyst', 'admin'),
  RecordController.exportCsv
);

/**
 * @route   GET /api/v1/records
 * @desc    List records (filtered, paginated, scoped)
 * @access  All authenticated users (scoped to department)
 */
router.get(
  '/',
  authorize('viewer', 'analyst', 'admin'),
  validate(listRecordsQuerySchema),
  RecordController.list
);

/**
 * @route   GET /api/v1/records/:id
 * @desc    Get record by ID (scoped)
 * @access  All authenticated users
 */
router.get(
  '/:id',
  authorize('viewer', 'analyst', 'admin'),
  validate(recordIdParamSchema),
  RecordController.getById
);

/**
 * @route   PUT /api/v1/records/:id
 * @desc    Update a financial record
 * @access  Admin only
 */
router.put(
  '/:id',
  authorize('admin'),
  validate(updateRecordSchema),
  RecordController.update
);

/**
 * @route   DELETE /api/v1/records/:id
 * @desc    Soft delete a financial record
 * @access  Admin only
 */
router.delete(
  '/:id',
  authorize('admin'),
  validate(recordIdParamSchema),
  RecordController.delete
);

export default router;
