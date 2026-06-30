import { pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  username: text('username').notNull(),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
  status: text('status').notNull().default('approved'), // 'pending' | 'approved' | 'declined'
  partner: text('partner'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tickets = pgTable('tickets', {
  id: text('id').primaryKey(), // TKT-XXXX
  date: text('date').notNull(),
  officerName: text('officer_name').notNull(),
  phone: text('phone').notNull(),
  partner: text('partner').notNull(),
  region: text('region').notNull(),
  anydeskAddress: text('anydesk_address').notNull().default(''),
  deviceType: text('device_type').notNull().default(''),
  kitNumber: text('kit_number').notNull(),
  issueDescription: text('issue_description').notNull(),
  status: text('status').notNull().default('Open'), // 'Open' | 'In Review' | 'Done'
  responseText: text('response_text'),
  responderName: text('responder_name'),
  assignedTo: text('assigned_to'),
  issueTypes: text('issue_types'),
  hwIssueStatus: text('hw_issue_status'),
  hwResolutionMethod: text('hw_resolution_method'),
  hwReplacementSource: text('hw_replacement_source'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const hardwareTickets = pgTable('hardware_tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: text('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  issueStatus: text('issue_status'),
  resolutionMethod: text('resolution_method'),
  replacementSource: text('replacement_source'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const hardware = pgTable('hardware', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),
  officerName: text('officer_name').notNull(),
  phone: text('phone').notNull(),
  partner: text('partner').notNull(),
  region: text('region').notNull(),
  regCenterName: text('reg_center_name'),
  kitNumber: text('kit_number').notNull(),
  kitType: text('kit_type'),
  issueTypes: text('issue_types'),
  issueDescription: text('issue_description').notNull(),
  verifiedBy: text('verified_by'),
  dateVerified: text('date_verified'),
  status: text('status').notNull().default('Open'),
  hwIssueStatus: text('hw_issue_status').default('Under Repair'),
  hwResolutionMethod: text('hw_resolution_method'),
  hwReplacementSource: text('hw_replacement_source'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

