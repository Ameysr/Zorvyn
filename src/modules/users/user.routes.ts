import { Router } from 'express';
import { UserController } from './user.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validator.js';
import {
  updateUserSchema,
  changeRoleSchema,
  changeStatusSchema,
  userIdParamSchema,
  listUsersQuerySchema,
} from './user.validator.js';

const router = Router();

// All user management routes require admin role
router.use(authenticate, authorize('admin'));

/**
 * @route   GET /api/v1/users
 * @desc    List all users (paginated, filterable)
 * @access  Admin only
 */
router.get('/', validate(listUsersQuerySchema), UserController.list);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Admin only
 */
router.get('/:id', validate(userIdParamSchema), UserController.getById);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update user profile
 * @access  Admin only
 */
router.put('/:id', validate(updateUserSchema), UserController.update);

/**
 * @route   PATCH /api/v1/users/:id/role
 * @desc    Change user role
 * @access  Admin only
 */
router.patch('/:id/role', validate(changeRoleSchema), UserController.changeRole);

/**
 * @route   PATCH /api/v1/users/:id/status
 * @desc    Change user status (active/inactive/suspended)
 * @access  Admin only
 */
router.patch('/:id/status', validate(changeStatusSchema), UserController.changeStatus);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Soft delete user
 * @access  Admin only
 */
router.delete('/:id', validate(userIdParamSchema), UserController.delete);

export default router;
