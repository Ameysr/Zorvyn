import Joi from 'joi';

export const registerSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().min(8).max(128).required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain at least one uppercase, one lowercase, and one number',
        'any.required': 'Password is required',
      }),
    full_name: Joi.string().trim().min(2).max(255).required().messages({
      'string.min': 'Full name must be at least 2 characters',
      'any.required': 'Full name is required',
    }),
    department: Joi.string().trim().max(100).default('general'),
  }),
};

export const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
  }),
};

export const refreshSchema = {
  body: Joi.object({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token is required',
    }),
  }),
};
