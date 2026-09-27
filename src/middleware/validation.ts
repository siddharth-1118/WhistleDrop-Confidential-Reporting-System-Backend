import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const createReportSchema = z.object({
  category: z.enum(['Security', 'Harassment', 'Corruption', 'Technical', 'Other'], {
    errorMap: () => ({
      message: 'Category must be one of: Security, Harassment, Corruption, Technical, Other',
    }),
  }),
  description: z.string().min(10, 'Description must be at least 10 characters long').max(5000, 'Description cannot exceed 5000 characters'),
  evidenceUrl: z.string().url('Evidence URL must be a valid URL').optional().or(z.literal('')),
});

export const updateStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'], {
    errorMap: () => ({
      message: 'Status must be one of: SUBMITTED, UNDER_REVIEW, RESOLVED, DISMISSED',
    }),
  }),
  note: z.string().min(3, 'Status update note must be at least 3 characters long').max(1000, 'Status update note cannot exceed 1000 characters'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((e) => e.message);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: issues,
        });
        return;
      }
      next(error);
    }
  };
}
