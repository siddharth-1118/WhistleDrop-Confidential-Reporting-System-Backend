import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/utils/db';
import bcrypt from 'bcrypt';

describe('WhistleDrop API Integration Tests', () => {
  let moderatorToken: string;
  let createdCaseCode: string;
  let reportId: string;

  beforeAll(async () => {
    // Setup clean test database state
    await prisma.auditLog.deleteMany({});
    await prisma.privateNote.deleteMany({});
    await prisma.timelineItem.deleteMany({});
    await prisma.report.deleteMany({});
    await prisma.moderator.deleteMany({});

    // Create test moderator
    const passwordHash = await bcrypt.hash('testpass123', 10);
    await prisma.moderator.create({
      data: {
        username: 'testadmin',
        passwordHash,
        role: 'MODERATOR',
      },
    });

    // Authenticate test moderator to get token
    const loginRes = await request(app)
      .post('/api/moderator/login')
      .send({ username: 'testadmin', password: 'testpass123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.token).toBeDefined();
    moderatorToken = loginRes.body.data.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Anonymous Report Submission (POST /api/reports)', () => {
    it('should allow submitting an anonymous report without account/credentials', async () => {
      const res = await request(app)
        .post('/api/reports')
        .send({
          category: 'Security Breach',
          title: 'Exposed API Keys in Production Logs',
          description: 'Critical API endpoint returning unhashed database connection strings.',
          department: 'Engineering',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.caseCode).toMatch(/^WD-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(res.body.data.category).toBe('Security Breach');
      expect(res.body.data.status).toBe('SUBMITTED');

      createdCaseCode = res.body.data.caseCode;
    });

    it('should reject invalid report categories', async () => {
      const res = await request(app)
        .post('/api/reports')
        .send({
          category: 'InvalidCategory',
          description: 'Testing invalid category rejection logic.',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Anonymous Case Tracking (POST /api/reports/lookup)', () => {
    it('should return report details given a valid case code', async () => {
      const res = await request(app)
        .post('/api/reports/lookup')
        .send({ caseCode: createdCaseCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.caseCode).toBe(createdCaseCode);
      expect(res.body.data.status).toBe('SUBMITTED');
      expect(res.body.data.publicTimeline.length).toBeGreaterThanOrEqual(1);
      // Ensure private notes are NOT returned in public lookup
      expect(res.body.data.privateNotes).toBeUndefined();
    });

    it('should return 404 for an invalid case code without leaking system info', async () => {
      const res = await request(app)
        .post('/api/reports/lookup')
        .send({ caseCode: 'WD-INVALID-CODE' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Moderator Auth & Management (POST /api/moderator/notes & audit)', () => {
    it('should deny unauthorized access to moderator endpoints', async () => {
      const res = await request(app).get('/api/moderator/reports');
      expect(res.status).toBe(401);
    });

    it('should allow authenticated moderator to list reports', async () => {
      const res = await request(app)
        .get('/api/moderator/reports')
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      reportId = res.body.data[0].id;
    });

    it('should allow moderator to update report status to UNDER_REVIEW', async () => {
      const res = await request(app)
        .patch(`/api/moderator/reports/${reportId}/status`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          status: 'UNDER_REVIEW',
          note: 'Assigned to Security Team.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.report.status).toBe('UNDER_REVIEW');
    });

    it('should allow adding private internal notes and public timeline updates separately', async () => {
      // Add Private Note
      const privRes = await request(app)
        .post(`/api/moderator/reports/${reportId}/notes`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          note: 'Internal investigator note: IP logs confirm external leak source.',
          isPublic: false,
        });

      expect(privRes.status).toBe(201);
      expect(privRes.body.data.authorName).toBe('testadmin');

      // Add Public Update
      const pubRes = await request(app)
        .post(`/api/moderator/reports/${reportId}/notes`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          note: 'Public Update: Mitigating controls applied.',
          isPublic: true,
        });

      expect(pubRes.status).toBe(201);

      // Verify reporter lookup receives public update BUT NOT private note
      const lookupRes = await request(app)
        .post('/api/reports/lookup')
        .send({ caseCode: createdCaseCode });

      expect(lookupRes.status).toBe(200);
      const timelineNotes = lookupRes.body.data.publicTimeline.map((t: any) => t.note);
      expect(timelineNotes).toContain('Public Update: Mitigating controls applied.');
      expect(timelineNotes).not.toContain('Internal investigator note: IP logs confirm external leak source.');
    });

    it('should retrieve audit trail logs for moderators', async () => {
      const res = await request(app)
        .get('/api/moderator/audit')
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
