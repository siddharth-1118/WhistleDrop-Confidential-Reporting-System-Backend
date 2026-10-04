import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'whistledrop-super-secret-jwt-key-2026-gdg',
  databaseUrl: process.env.DATABASE_URL || 'file:./whistledrop.db',
  categories: [
    'Harassment',
    'Security Breach',
    'Corruption',
    'Workplace Safety',
    'Technical Misconduct',
    'Other',
  ] as const,
  statuses: ['SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const,
};
