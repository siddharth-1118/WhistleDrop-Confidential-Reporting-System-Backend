import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { comparePassword, signJwt } from '../utils/security';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Moderator Login
 */
export async function moderatorLogin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username, password } = req.body;

    const moderator = await prisma.moderator.findUnique({
      where: { username },
    });

    if (!moderator) {
      throw new AppError('Invalid username or password', 401);
    }

    const isValidPassword = await comparePassword(password, moderator.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid username or password', 401);
    }

    const token = signJwt({
      moderatorId: moderator.id,
      username: moderator.username,
      role: moderator.role,
    });

    res.status(200).json({
      success: true,
      message: 'Moderator authenticated successfully',
      data: {
        token,
        username: moderator.username,
        role: moderator.role,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get All Reports with Optional Filtering by Category and Status
 */
export async function getAllReports(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category, status } = req.query;

    const whereClause: { category?: string; status?: string } = {};

    if (typeof category === 'string') {
      whereClause.category = category;
    }

    if (typeof status === 'string') {
      whereClause.status = status;
    }

    const reports = await prisma.report.findMany({
      where: whereClause,
      select: {
        id: true,
        caseCode: true,
        category: true,
        description: true,
        evidenceUrl: true,
        status: true,
        isClosed: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { statusUpdates: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Single Report Details for Moderator
 */
export async function getReportById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        statusUpdates: {
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

/**
 * Update Report Status and Append Status Update Note
 */
export async function updateReportStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const { status: newStatus, note } = req.body;

    const report = await prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      throw new AppError('Report not found', 404);
    }

    if (report.isClosed) {
      throw new AppError('Cannot update status of a permanently closed case.', 400);
    }

    if (report.status === newStatus) {
      throw new AppError(`Report status is already set to '${newStatus}'.`, 400);
    }

    const previousStatus = report.status;
    const moderatorName = req.moderator ? req.moderator.username : 'Moderator';

    // Transaction to update report status and insert status update history
    const [updatedReport, statusUpdate] = await prisma.$transaction([
      prisma.report.update({
        where: { id },
        data: { status: newStatus },
      }),
      prisma.statusUpdate.create({
        data: {
          reportId: id,
          previousStatus,
          newStatus,
          note,
          createdBy: `Moderator (${moderatorName})`,
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: `Report status updated from '${previousStatus}' to '${newStatus}'`,
      data: {
        report: updatedReport,
        statusUpdate,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Permanently Close/Archive Case (Brownie Points Feature)
 */
export async function closeReportCase(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    const report = await prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      throw new AppError('Report not found', 404);
    }

    if (report.isClosed) {
      throw new AppError('Report case is already permanently closed.', 400);
    }

    const moderatorName = req.moderator ? req.moderator.username : 'Moderator';

    const [closedReport] = await prisma.$transaction([
      prisma.report.update({
        where: { id },
        data: { isClosed: true },
      }),
      prisma.statusUpdate.create({
        data: {
          reportId: id,
          previousStatus: report.status,
          newStatus: report.status,
          note: 'Case permanently closed by moderator.',
          createdBy: `Moderator (${moderatorName})`,
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Case permanently closed.',
      data: closedReport,
    });
  } catch (error) {
    next(error);
  }
}
