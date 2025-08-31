import { serial, varchar, decimal, timestamp, boolean, text, pgTable } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  nickname: varchar('nickname', { length: 100 }),
  balance: decimal('balance', { precision: 10, scale: 2 }).default('0.00'),
  status: varchar('status', { length: 20 }).default('active'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow()
});

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).default('admin'),
  created_at: timestamp('created_at').defaultNow()
});

export const loginAttempts = pgTable('login_attempts', {
  id: serial('id').primaryKey(),
  ip_address: varchar('ip_address', { length: 45 }).notNull(),
  username: varchar('username', { length: 50 }),
  attempted_at: timestamp('attempted_at').defaultNow(),
  success: boolean('success').default(false)
});