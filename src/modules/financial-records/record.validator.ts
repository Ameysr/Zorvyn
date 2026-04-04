import Joi from 'joi';
import { isValidMoneyAmount } from '../../shared/money.js';

// Custom Joi validator for money amounts (string format, decimal-safe)
const moneyAmount = Joi.string().custom((value, helpers) => {
  if (!isValidMoneyAmount(value)) {
    return helpers.error('any.invalid');
  }
  return value;
}).messages({
  'any.invalid': 'Amount must be a valid numeric string (e.g., "1500.0000")',
});

export const createRecordSchema = {
  body: Joi.object({
    amount: moneyAmount.required().messages({
      'any.required': 'Amount is required',
    }),
    type: Joi.string().valid('income', 'expense', 'transfer').required().messages({
      'any.only': 'Type must be one of: income, expense, transfer',
      'any.required': 'Type is required',
    }),
    category: Joi.string().trim().max(100).required().messages({
      'any.required': 'Category is required',
    }),
    description: Joi.string().trim().max(1000).allow(null, ''),
    date: Joi.date().iso().required().messages({
      'date.format': 'Date must be in ISO format (YYYY-MM-DD)',
      'any.required': 'Date is required',
    }),
    department: Joi.string().trim().max(100),
  }),
};

export const updateRecordSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    amount: moneyAmount,
    type: Joi.string().valid('income', 'expense', 'transfer'),
    category: Joi.string().trim().max(100),
    description: Joi.string().trim().max(1000).allow(null, ''),
    date: Joi.date().iso(),
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update',
  }),
};

export const recordIdParamSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

export const listRecordsQuerySchema = {
  query: Joi.object({
    type: Joi.string().valid('income', 'expense', 'transfer'),
    category: Joi.string().max(100),
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('date', 'amount', 'created_at', 'category').default('date'),
    order: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};
