/**
 * Seed Script — Creates demo data for evaluation
 * 
 * Usage: npm run seed
 * 
 * Creates:
 * - 3 demo users (admin, analyst, viewer) across departments
 * - ~100 realistic financial records spanning 6 months
 * - All passwords: Password123!
 */
import bcrypt from 'bcrypt';
import pool from '../src/config/database.js';
import { runMigrations, closeDatabasePool } from '../src/config/database.js';
import { closeRedisConnection } from '../src/config/redis.js';
import { logger } from '../src/shared/logger.js';

const DEMO_PASSWORD = 'Password123!';
const SALT_ROUNDS = 12;

interface DemoUser {
  email: string;
  full_name: string;
  role: string;
  department: string;
}

const DEMO_USERS: DemoUser[] = [
  { email: 'admin@zorvyn.io', full_name: 'Arjun Mehta', role: 'admin', department: 'headquarters' },
  { email: 'analyst@zorvyn.io', full_name: 'Priya Sharma', role: 'analyst', department: 'finance' },
  { email: 'viewer@zorvyn.io', full_name: 'Rahul Patel', role: 'viewer', department: 'marketing' },
];

const CATEGORIES = {
  income: ['revenue', 'consulting', 'subscriptions', 'investment_returns', 'grants'],
  expense: ['salary', 'rent', 'utilities', 'software', 'marketing', 'equipment', 'travel', 'insurance'],
};

const DESCRIPTIONS = {
  revenue: ['Monthly SaaS revenue', 'Enterprise contract payment', 'Quarterly recurring revenue'],
  consulting: ['Strategy consulting engagement', 'Technical advisory session', 'Implementation support'],
  subscriptions: ['Premium tier subscription', 'Annual plan upgrade', 'Enterprise license renewal'],
  investment_returns: ['Q1 portfolio returns', 'Fixed deposit maturity', 'Mutual fund dividends'],
  grants: ['Innovation grant disbursement', 'R&D funding received', 'Government subsidy'],
  salary: ['Monthly payroll - Engineering', 'Monthly payroll - Sales', 'Monthly payroll - Operations'],
  rent: ['Office lease - Bangalore HQ', 'Co-working space rental', 'Warehouse rental'],
  utilities: ['Electricity and water bill', 'Internet and telecom', 'Office maintenance'],
  software: ['AWS infrastructure costs', 'GitHub Enterprise license', 'Figma team subscription'],
  marketing: ['Google Ads campaign', 'Social media marketing', 'Conference sponsorship'],
  equipment: ['Laptop procurement', 'Server hardware upgrade', 'Office furniture'],
  travel: ['Client visit - Mumbai', 'Team offsite expenses', 'Conference travel'],
  insurance: ['Business liability insurance', 'Employee health insurance', 'Asset insurance'],
};

function randomDate(monthsBack: number): string {
  const now = new Date();
  const past = new Date(now);
  past.setMonth(past.getMonth() - monthsBack);
  const diff = now.getTime() - past.getTime();
  const randomTime = past.getTime() + Math.random() * diff;
  return new Date(randomTime).toISOString().split('T')[0];
}

function randomAmount(min: number, max: number): string {
  const amount = min + Math.random() * (max - min);
  return amount.toFixed(4);
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  try {
    logger.info('🌱 Starting seed process...');

    // Run migrations first
    await runMigrations();

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

    // Create demo users
    const userIds: string[] = [];
    for (const user of DEMO_USERS) {
      const { rows } = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, department)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET
           password_hash = $2, full_name = $3, role = $4, department = $5,
           deleted_at = NULL, status = 'active'
         RETURNING id`,
        [user.email, passwordHash, user.full_name, user.role, user.department]
      );
      userIds.push(rows[0].id);
      logger.info(`👤 Created/updated user: ${user.email} (${user.role}, ${user.department})`);
    }

    const adminId = userIds[0]; // Admin creates all records
    const departments = ['headquarters', 'finance', 'marketing', 'engineering'];

    // Generate ~100 financial records
    let recordCount = 0;
    for (let i = 0; i < 100; i++) {
      const type = Math.random() > 0.45 ? 'income' : 'expense';
      const categories = CATEGORIES[type as keyof typeof CATEGORIES];
      const category = randomChoice(categories);
      const descriptions = DESCRIPTIONS[category as keyof typeof DESCRIPTIONS] || ['General transaction'];
      const description = randomChoice(descriptions);
      const department = randomChoice(departments);
      const date = randomDate(6); // Last 6 months

      let amount: string;
      if (type === 'income') {
        amount = randomAmount(5000, 500000);
      } else {
        amount = randomAmount(1000, 100000);
      }

      await pool.query(
        `INSERT INTO financial_records (amount, type, category, description, date, department, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [amount, type, category, description, date, department, adminId]
      );
      recordCount++;
    }

    logger.info(`💰 Created ${recordCount} financial records`);

    // Summary
    logger.info('\n============================================');
    logger.info('🎉 Seed complete! Demo credentials:');
    logger.info('============================================');
    logger.info(`  Admin:   admin@zorvyn.io   / ${DEMO_PASSWORD} (department: headquarters)`);
    logger.info(`  Analyst: analyst@zorvyn.io / ${DEMO_PASSWORD} (department: finance)`);
    logger.info(`  Viewer:  viewer@zorvyn.io  / ${DEMO_PASSWORD} (department: marketing)`);
    logger.info('============================================\n');

  } catch (error) {
    logger.error({ err: error }, '❌ Seed failed');
    throw error;
  } finally {
    await closeDatabasePool();
    await closeRedisConnection();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
