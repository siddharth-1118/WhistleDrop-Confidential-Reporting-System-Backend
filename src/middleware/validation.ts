import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const createReportSchema = z.object({
  category: z.enum([
    'Harassment',
    'Security Breach',
    'Corruption',
    'Workplace Safety',
    'Technical Misconduct',
    'Other',
  ], {
    errorMap: () => ({
      message: 'Category must be one of: Harassment, Security Breach, Corruption, Workplace Safety, Technical Misconduct, Other',
    }),
  }),
  title: z.string().max(200, 'Title cannot exceed 200 characters').optional().or(z.literal('')),
  description: z.string().min(10, 'Description must be at least 10 characters long').max(5000, 'Description cannot exceed 5000 characters'),
  incidentDate: z.string().optional().or(z.literal('')),
  department: z.string().max(100, 'Department cannot exceed 100 characters').optional().or(z.literal('')),
});

export const lookupReportSchema = z.object({
  caseCode: z.string().min(5, 'Case code is required'),
});

export const updateStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'], {
    errorMap: () => ({
      message: 'Status must be one of: SUBMITTED, UNDER_REVIEW, RESOLVED, DISMISSED',
    }),
  }),
  note: z.string().min(3, 'Status update note must be at least 3 characters long').max(1000),
});

export const addNoteSchema = z.object({
  note: z.string().min(3, 'Note text must be at least 3 characters long').max(2000),
  isPublic: z.boolean().optional().default(false),
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
