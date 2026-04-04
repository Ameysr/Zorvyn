import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/authenticate.js';
import { registerSchema, loginSchema, refreshSchema } from './auth.validator.js';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validate(registerSchema), AuthController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login with email and password
 * @access  Public
 */
router.post('/login', validate(loginSchema), AuthController.login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public (with valid refresh token)
 */
router.post('/refresh', validate(refreshSchema), AuthController.refresh);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current authenticated user's profile
 * @access  Protected
 */
router.get('/me', authenticate, AuthController.me);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout and revoke refresh token
 * @access  Protected
 */
router.post('/logout', authenticate, AuthController.logout);

export default router;
