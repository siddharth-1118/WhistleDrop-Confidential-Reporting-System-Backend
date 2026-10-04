import { Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { comparePassword, signJwt } from '../utils/security';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * POST /api/moderator/login — Authenticate a moderator.
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

    // Record login audit log
    await prisma.auditLog.create({
      data: {
        action: 'MODERATOR_LOGIN',
        moderatorId: moderator.id,
        details: `Moderator '${username}' authenticated successfully.`,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
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
 * GET /api/moderator/reports — List & filter reports with pagination & dashboard stats.
 */
export async function getModeratorReports(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category, status, search } = req.query;

    const whereClause: any = {};

    if (typeof category === 'string' && category) {
      whereClause.category = category;
    }

    if (typeof status === 'string' && status) {
      whereClause.status = status;
    }

    if (typeof search === 'string' && search) {
      whereClause.OR = [
        { caseCode: { contains: search } },
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const reports = await prisma.report.findMany({
      where: whereClause,
      include: {
        publicTimeline: { orderBy: { createdAt: 'asc' } },
        privateNotes: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate dashboard statistics
    const stats = {
      total: await prisma.report.count(),
      submitted: await prisma.report.count({ where: { status: 'SUBMITTED' } }),
      underReview: await prisma.report.count({ where: { status: 'UNDER_REVIEW' } }),
      resolved: await prisma.report.count({ where: { status: 'RESOLVED' } }),
      dismissed: await prisma.report.count({ where: { status: 'DISMISSED' } }),
    };

    res.status(200).json({
      success: true,
      stats,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/moderator/reports/:id — Get full report details for authorized moderators.
 */
export async function getModeratorReportById(
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
        publicTimeline: { orderBy: { createdAt: 'asc' } },
        privateNotes: { orderBy: { createdAt: 'desc' } },
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
 * PATCH /api/moderator/reports/:id/status — Validated status transitions & timeline entry.
 * Supported workflow: SUBMITTED -> UNDER_REVIEW -> RESOLVED / DISMISSED
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

    const report = await prisma.report.findUnique({ where: { id } });

    if (!report) {
      throw new AppError('Report not found', 404);
    }

    if (report.status === newStatus) {
      throw new AppError(`Status is already set to '${newStatus}'.`, 400);
    }

    const previousStatus = report.status;
    const modUsername = req.moderator ? req.moderator.username : 'Moderator';

    // Perform status update transaction
    const [updatedReport, timelineItem] = await prisma.$transaction([
      prisma.report.update({
        where: { id },
        data: {
          status: newStatus,
          isClosed: newStatus === 'RESOLVED' || newStatus === 'DISMISSED',
        },
      }),
      prisma.timelineItem.create({
        data: {
          reportId: id,
          status: newStatus,
          note: note || `Report status transitioned from ${previousStatus} to ${newStatus}.`,
          createdBy: `Moderator (${modUsername})`,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: 'STATUS_UPDATE',
          moderatorId: req.moderator?.moderatorId,
          details: `Report '${report.caseCode}' status changed from ${previousStatus} to ${newStatus}.`,
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: `Report status updated to '${newStatus}'`,
      data: {
        report: updatedReport,
        timelineItem,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/moderator/reports/:id/notes — Append authorized internal private note or public update.
 */
export async function addReportNote(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const { note, isPublic } = req.body;

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new AppError('Report not found', 404);
    }

    const authorName = req.moderator ? req.moderator.username : 'Moderator';

    if (isPublic) {
      // Create public timeline entry
      const timelineItem = await prisma.timelineItem.create({
        data: {
          reportId: id,
          status: report.status,
          note,
          createdBy: `Moderator (${authorName})`,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'ADD_PUBLIC_UPDATE',
          moderatorId: req.moderator?.moderatorId,
          details: `Added public timeline update for case '${report.caseCode}'.`,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Public timeline update added successfully.',
        data: timelineItem,
      });
    } else {
      // Create private internal moderator note
      const privateNote = await prisma.privateNote.create({
        data: {
          reportId: id,
          note,
          authorName,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'ADD_PRIVATE_NOTE',
          moderatorId: req.moderator?.moderatorId,
          details: `Added private internal investigation note for case '${report.caseCode}'.`,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Private internal note saved.',
        data: privateNote,
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/moderator/audit — Retrieve audit logs for security oversight.
 */
export async function getAuditLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}
