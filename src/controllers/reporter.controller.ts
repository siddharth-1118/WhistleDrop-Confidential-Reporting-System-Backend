import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { generateCaseCode } from '../utils/security';
import { AppError } from '../middleware/errorHandler';

/**
 * Anonymous Report Submission
 * ZERO reporter PII (IP address, user agent, etc.) is recorded or saved.
 */
export async function submitReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category, description, evidenceUrl } = req.body;

    let caseCode = generateCaseCode();
    // Ensure uniqueness
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
        description,
        evidenceUrl: evidenceUrl || null,
        status: 'SUBMITTED',
        statusUpdates: {
          create: {
            previousStatus: 'NONE',
            newStatus: 'SUBMITTED',
            note: 'Report successfully submitted anonymously to WhistleDrop system.',
            createdBy: 'System',
          },
        },
      },
      include: {
        statusUpdates: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Please store your case code safely to track progress anonymously.',
      data: {
        caseCode: report.caseCode,
        category: report.category,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Public Case Tracking
 * Allows reporter to check report progress using their secure case code.
 */
export async function trackReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const caseCodeRaw = req.params.caseCode;
    const caseCode = Array.isArray(caseCodeRaw) ? caseCodeRaw[0] : caseCodeRaw;

    if (!caseCode) {
      throw new AppError('Case code is required', 400);
    }

    const report = await prisma.report.findUnique({
      where: { caseCode: caseCode.trim() },
      select: {
        caseCode: true,
        category: true,
        status: true,
        isClosed: true,
        createdAt: true,
        updatedAt: true,
        statusUpdates: {
          select: {
            newStatus: true,
            note: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!report) {
      throw new AppError('No report found with the provided case code. Please check the code and try again.', 404);
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
