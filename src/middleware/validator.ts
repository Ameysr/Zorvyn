import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponseHelper } from '../shared/apiResponse.js';

/**
 * Request Validation Middleware Factory
 * 
 * Validates request body, query, and params against Joi schemas.
 * Returns 400 with detailed validation errors on failure.
 * 
 * Usage:
 *   router.post('/records', validate(createRecordSchema), handler)
 */

interface ValidationSchemas {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, string[]> = {};

    if (schemas.body) {
      const { error } = schemas.body.validate(req.body, { abortEarly: false, stripUnknown: true });
      if (error) {
        errors.body = error.details.map((d) => d.message);
      } else {
        // Use validated (and stripped) value
        req.body = schemas.body.validate(req.body, { stripUnknown: true }).value;
      }
    }

    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, { abortEarly: false, stripUnknown: true });
      if (error) {
        errors.query = error.details.map((d) => d.message);
      } else {
        req.query = value;
      }
    }

    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.params = error.details.map((d) => d.message);
      } else {
        req.params = value;
      }
    }

    if (Object.keys(errors).length > 0) {
      ApiResponseHelper.badRequest(res, 'Validation failed', errors);
      return;
    }

    next();
  };
}
