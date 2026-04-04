import Joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string().required(),

  REDIS_URL: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
}).unknown(true);

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  console.error(`❌ Environment validation error: ${error.message}`);
  process.exit(1);
}

const config = {
  nodeEnv: envVars.NODE_ENV as string,
  port: envVars.PORT as number,
  isProduction: envVars.NODE_ENV === 'production',
  isDevelopment: envVars.NODE_ENV === 'development',
  isTest: envVars.NODE_ENV === 'test',

  database: {
    url: envVars.DATABASE_URL as string,
  },

  redis: {
    url: envVars.REDIS_URL as string,
  },

  jwt: {
    accessSecret: envVars.JWT_ACCESS_SECRET as string,
    refreshSecret: envVars.JWT_REFRESH_SECRET as string,
    accessExpiry: envVars.JWT_ACCESS_EXPIRY as string,
    refreshExpiry: envVars.JWT_REFRESH_EXPIRY as string,
  },

  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS as number,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS as number,
  },

  logLevel: envVars.LOG_LEVEL as string,
};

export default config;
