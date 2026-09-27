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
    await prisma.statusUpdate.deleteMany({});
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
      .post('/api/v1/moderators/login')
      .send({ username: 'testadmin', password: 'testpass123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.token).toBeDefined();
    moderatorToken = loginRes.body.data.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Anonymous Report Submission', () => {
    it('should allow submitting an anonymous report without account/credentials', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .send({
          category: 'Security',
          description: 'Critical API endpoint returning unhashed database connection strings.',
          evidenceUrl: 'https://example.com/evidence/logs.txt',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.caseCode).toMatch(/^WD-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(res.body.data.category).toBe('Security');
      expect(res.body.data.status).toBe('SUBMITTED');

      createdCaseCode = res.body.data.caseCode;
    });

    it('should reject invalid report categories', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .send({
          category: 'InvalidCategory',
          description: 'Testing invalid category rejection logic.',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject descriptions shorter than 10 characters', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .send({
          category: 'Technical',
          description: 'Short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Case Tracking (Anonymous)', () => {
    it('should return report details given a valid case code', async () => {
      const res = await request(app).get(`/api/v1/reports/track/${createdCaseCode}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.caseCode).toBe(createdCaseCode);
      expect(res.body.data.status).toBe('SUBMITTED');
      expect(res.body.data.statusUpdates.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 404 for an invalid or non-existent case code', async () => {
      const res = await request(app).get('/api/v1/reports/track/WD-INVALID-CODE');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Moderator Auth & Report Management', () => {
    it('should deny unauthorized access to moderator endpoints', async () => {
      const res = await request(app).get('/api/v1/moderators/reports');

      expect(res.status).toBe(401);
    });

    it('should allow authenticated moderator to list all reports', async () => {
      const res = await request(app)
        .get('/api/v1/moderators/reports')
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      reportId = res.body.data[0].id;
    });

    it('should filter reports by category', async () => {
      const res = await request(app)
        .get('/api/v1/moderators/reports?category=Security')
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((r: any) => r.category === 'Security')).toBe(true);
    });

    it('should allow moderator to update report status to UNDER_REVIEW with a note', async () => {
      const res = await request(app)
        .patch(`/api/v1/moderators/reports/${reportId}/status`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          status: 'UNDER_REVIEW',
          note: 'Report assigned to Incident Response Team.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.report.status).toBe('UNDER_REVIEW');
      expect(res.body.data.statusUpdate.note).toBe('Report assigned to Incident Response Team.');
    });

    it('should reflect updated status on public tracking route', async () => {
      const res = await request(app).get(`/api/v1/reports/track/${createdCaseCode}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('UNDER_REVIEW');
      expect(res.body.data.statusUpdates.length).toBe(2);
      expect(res.body.data.statusUpdates[1].note).toBe('Report assigned to Incident Response Team.');
    });

    it('should prevent setting the exact same status', async () => {
      const res = await request(app)
        .patch(`/api/v1/moderators/reports/${reportId}/status`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          status: 'UNDER_REVIEW',
          note: 'Duplicate status check.',
        });

      expect(res.status).toBe(400);
    });

    it('should allow moderator to permanently close a report case', async () => {
      const res = await request(app)
        .post(`/api/v1/moderators/reports/${reportId}/close`)
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isClosed).toBe(true);
    });

    it('should disallow status updates on a closed report case', async () => {
      const res = await request(app)
        .patch(`/api/v1/moderators/reports/${reportId}/status`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({
          status: 'RESOLVED',
          note: 'Trying to update closed case.',
        });

      expect(res.status).toBe(400);
    });
  });
});
