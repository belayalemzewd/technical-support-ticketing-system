/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TicketStatus = 'Open' | 'In Review' | 'Done';

export interface Ticket {
  id: string;
  date: string; // YYYY-MM-DD
  officerName: string;
  phone: string;
  partner: string;
  region: string;
  anydeskAddress: string;
  deviceType: string;
  kitNumber: string;
  issueDescription: string;
  status: TicketStatus;
  responseText?: string;
  responderName?: string;
  assignedTo?: string;
  issueTypes?: string[];
  hwIssueStatus?: string;
  hwResolutionMethod?: string;
  hwReplacementSource?: string;
  regCenterName?: string;
  verifiedBy?: string;
  dateVerified?: string;
  kitType?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'user';
export type UserStatus = 'pending' | 'approved' | 'declined';

export interface User {
  id: string;
  uid?: string;
  username: string;
  email: string;
  role: UserRole;
  partner?: string; // Optional filtering for partner-bound users
  status?: UserStatus;
  createdAt?: string;
}

export interface DashboardStats {
  todayCount: number;
  monthCount: number;
  yearCount: number;
  statusCounts: {
    Open: number;
    'In Review': number;
    Done: number;
  };
  partnerCounts: Record<string, number>;
  regionCounts: Record<string, number>;
}
