import Joi from 'joi';

export const updateUserSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    full_name: Joi.string().trim().min(2).max(255),
    email: Joi.string().email(),
    department: Joi.string().trim().max(100),
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update',
  }),
};

export const changeRoleSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    role: Joi.string().valid('viewer', 'analyst', 'admin').required().messages({
      'any.only': 'Role must be one of: viewer, analyst, admin',
    }),
  }),
};

export const changeStatusSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'suspended').required().messages({
      'any.only': 'Status must be one of: active, inactive, suspended',
    }),
  }),
};

export const userIdParamSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

export const listUsersQuerySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    role: Joi.string().valid('viewer', 'analyst', 'admin'),
    status: Joi.string().valid('active', 'inactive', 'suspended'),
    department: Joi.string().max(100),
    sort: Joi.string().valid('created_at', 'full_name', 'email').default('created_at'),
    order: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};
