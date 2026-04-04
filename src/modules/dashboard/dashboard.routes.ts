import { Router } from 'express';
import { DashboardController } from './dashboard.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { scopeFilter } from '../../middleware/scopeFilter.js';

const router = Router();

// All dashboard routes require authentication + scope
router.use(authenticate, scopeFilter);

/**
 * @route   GET /api/v1/dashboard/summary
 * @desc    Get total income, expenses, net balance
 * @access  Analyst, Admin
 */
router.get('/summary', authorize('analyst', 'admin'), DashboardController.summary);

/**
 * @route   GET /api/v1/dashboard/category-breakdown
 * @desc    Get category-wise totals
 * @access  Analyst, Admin
 */
router.get('/category-breakdown', authorize('analyst', 'admin'), DashboardController.categoryBreakdown);

/**
 * @route   GET /api/v1/dashboard/trends
 * @desc    Get monthly trends (last 12 months)
 * @access  Analyst, Admin
 */
router.get('/trends', authorize('analyst', 'admin'), DashboardController.trends);

/**
 * @route   GET /api/v1/dashboard/recent-activity
 * @desc    Get recent financial activity
 * @access  All authenticated users
 */
router.get('/recent-activity', authorize('viewer', 'analyst', 'admin'), DashboardController.recentActivity);

export default router;
