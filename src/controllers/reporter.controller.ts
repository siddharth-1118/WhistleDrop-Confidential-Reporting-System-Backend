import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { generateCaseCode } from '../utils/security';
import { AppError } from '../middleware/errorHandler';

/**
 * POST /api/reports — Submit an anonymous report.
 * ZERO reporter PII (IP address, user agent, headers) is logged or stored.
 */
export async function submitReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category, title, description, incidentDate, department } = req.body;

    let caseCode = generateCaseCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.report.findUnique({ where: { caseCode } });
      if (!existing) break;
      caseCode = generateCaseCode();
      attempts++;
    }

    const report = await prisma.report.create({
      data: {
        caseCode,
        category,
        title: title || null,
        description,
        incidentDate: incidentDate || null,
        department: department || null,
        status: 'SUBMITTED',
        publicTimeline: {
          create: {
            status: 'SUBMITTED',
            note: 'Report received and assigned for security evaluation.',
            createdBy: 'System',
          },
        },
      },
      include: {
        publicTimeline: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Your report has been received.',
      data: {
        caseCode: report.caseCode,
        category: report.category,
        title: report.title,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reports/lookup — Access a report using case code in request body.
 * STRICT SECURITY GUARANTEE: Returns ONLY public timeline items; NEVER exposes private moderator notes.
 */
export async function lookupReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { caseCode } = req.body;

    if (!caseCode || typeof caseCode !== 'string') {
      throw new AppError('Case code is required in request body.', 400);
    }

    const report = await prisma.report.findUnique({
      where: { caseCode: caseCode.trim() },
      select: {
        caseCode: true,
        category: true,
        title: true,
        description: true,
        incidentDate: true,
        department: true,
        status: true,
        isClosed: true,
        createdAt: true,
        updatedAt: true,
        publicTimeline: {
          select: {
            id: true,
            status: true,
            note: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!report) {
      // Generic error response to prevent case code discovery/enumeration
      throw new AppError('Invalid case code or report unavailable. Please verify your code.', 404);
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/:id/timeline — Retrieve public investigation timeline information.
 */
export async function getReportTimeline(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const idParam = req.params.id;
    const reportId = Array.isArray(idParam) ? idParam[0] : idParam;

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: {
        caseCode: true,
        status: true,
        createdAt: true,
        publicTimeline: {
          select: {
            id: true,
            status: true,
            note: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!report) {
      throw new AppError('Report not found', 404);
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
