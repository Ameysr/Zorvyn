import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../../config/database.js';
import config from '../../config/env.js';
import { logger } from '../../shared/logger.js';
import { JwtPayload, TokenPair, User, UserPublic } from '../../types/index.js';
import { AppError } from '../../middleware/errorHandler.js';

const SALT_ROUNDS = 12;

/**
 * Auth Service — Handles registration, login, token management
 */
export class AuthService {
  /**
   * Register a new user
   */
  static async register(data: {
    email: string;
    password: string;
    full_name: string;
    department?: string;
  }): Promise<{ user: UserPublic; tokens: TokenPair }> {
    // Check for existing user
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [data.email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      throw new AppError(409, 'CONFLICT', 'Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Insert user
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, department)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, department, status, created_at, updated_at`,
      [data.email.toLowerCase(), passwordHash, data.full_name, data.department || 'general']
    );

    const user = rows[0] as UserPublic;

    // Generate tokens
    const tokens = await AuthService.generateTokens(user);

    logger.info({ userId: user.id, email: user.email }, 'User registered successfully');

    return { user, tokens };
  }

  /**
   * Login with email and password
   */
  static async login(email: string, password: string): Promise<{ user: UserPublic; tokens: TokenPair }> {
    // Find user
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, full_name, role, department, status, created_at, updated_at
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const user = rows[0] as User;

    // Check if user is active
    if (user.status !== 'active') {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is not active. Contact administrator.');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Generate tokens
    const userPublic: UserPublic = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      department: user.department,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    const tokens = await AuthService.generateTokens(userPublic);

    logger.info({ userId: user.id, email: user.email }, 'User logged in');

    return { user: userPublic, tokens };
  }

  /**
   * Refresh access token using a refresh token
   */
  static async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload & { jti: string };

      // Check if refresh token is revoked
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const { rows } = await pool.query(
        `SELECT id, revoked FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2`,
        [tokenHash, decoded.userId]
      );

      if (rows.length === 0 || rows[0].revoked) {
        throw new AppError(401, 'TOKEN_REVOKED', 'Refresh token has been revoked');
      }

      // Revoke the old refresh token (rotation)
      await pool.query(
        'UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1',
        [tokenHash]
      );

      // Get fresh user data
      const userResult = await pool.query(
        `SELECT id, email, full_name, role, department, status, created_at, updated_at
         FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        throw new AppError(401, 'USER_NOT_FOUND', 'User no longer exists');
      }

      const user = userResult.rows[0] as UserPublic;

      if (user.status !== 'active') {
        throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is not active');
      }

      // Generate new token pair
      const tokens = await AuthService.generateTokens(user);

      logger.info({ userId: user.id }, 'Token refreshed');

      return tokens;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error.name === 'TokenExpiredError') {
        throw new AppError(401, 'TOKEN_EXPIRED', 'Refresh token expired');
      }
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid refresh token');
    }
  }

  /**
   * Get user profile by ID
   */
  static async getProfile(userId: string): Promise<UserPublic> {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, department, status, created_at, updated_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (rows.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    return rows[0] as UserPublic;
  }

  /**
   * Logout — revoke refresh token
   */
  static async logout(refreshToken: string, userId: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1 AND user_id = $2',
      [tokenHash, userId]
    );
    logger.info({ userId }, 'User logged out — refresh token revoked');
  }

  /**
   * Generate access + refresh token pair
   */
  private static async generateTokens(user: UserPublic): Promise<TokenPair> {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
    };

    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry,
    });

    const jti = crypto.randomUUID();
    const refreshToken = jwt.sign(
      { ...payload, jti },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiry }
    );

    // Store refresh token hash in DB for revocation support
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    return { accessToken, refreshToken };
  }
}
