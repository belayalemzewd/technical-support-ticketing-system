import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";
import { db } from "./src/db/index.ts";
import { tickets, users, hardwareTickets, hardware } from "./src/db/schema.ts";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import {
  isSupabaseConfigured,
  getSupabaseClient,
  mapTicketToCamelCase,
  mapTicketToSnakeCase,
  mapUserToCamelCase,
  mapUserToSnakeCase,
  detectSupabaseColumns,
  isHardwareIssueTypesArray,
  isTicketsIssueTypesArray
} from "./src/lib/supabase-client.ts";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Prevent unhandled promise rejections or uncaught exceptions from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught Exception:', error);
});

// Lazy Gemini Client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured on the server.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Helper to generate ISO date strings relative to today
const getRelativeDate = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
};

const memoryUsers: any[] = [];
const memoryTickets: any[] = [];
const memoryHardwareTickets: any[] = [];
const memoryHardware: any[] = [];

async function startServer() {
  // Discover supported columns from remote Supabase schema if configured
  await detectSupabaseColumns();

  const app = express();
  const PORT = 5173;

  app.use(express.json({ limit: "15mb" }));

  // Wait, let's implement database operations with robust error handling layers

  // 1. Database Seeding - ensures initial tickets exist (run asynchronously to avoid blocking server boot)
  (async () => {
    try {
      const mockTickets = [
        {
          id: 'TKT-1001',
          date: getRelativeDate(0), // Today
          officerName: 'Sarah Jenkins',
          phone: '+251 911 234 567',
          partner: 'Safaricom',
          region: 'Tigray Region',
          anydeskAddress: 'AD-804-129-374',
          deviceType: 'BioRugged',
          kitNumber: 'KIT-9021',
          issueDescription: 'The solar charging system is not outputting power to the micro-server. The controller displays a battery-low fault blinking icon.',
          status: 'Open',
          createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        },
        {
          id: 'TKT-1002',
          date: getRelativeDate(1), // Yesterday
          officerName: 'James Mulgrew',
          phone: '+44 7712 345678',
          partner: 'Ethio Tele',
          region: 'Oromia Region',
          anydeskAddress: 'AD-411-929-281',
          deviceType: 'Laxton',
          kitNumber: 'KIT-5412',
          issueDescription: 'Tablet devices are unable to discover the local offline content server over Wi-Fi. Access point SSID is visible but login screen fails to load.',
          status: 'In Review',
          responseText: 'We suspect DHCP range issues. Please restart the access point router first. We are investigating standard router configuration profiles.',
          responderName: 'Marcus Vance (Admin)',
          createdAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        },
        {
          id: 'TKT-1003',
          date: getRelativeDate(5), // 5 days ago
          officerName: 'Abebe Kebede',
          phone: '+251 922 456 789',
          partner: 'CBE Bank',
          region: 'South Ethiopia Region',
          anydeskAddress: 'AD-105-294-884',
          deviceType: 'Emptech',
          kitNumber: 'KIT-2231',
          issueDescription: 'Secondary projector bulb is burnt out and needs replacement. The students cannot view the interactive slides.',
          status: 'Done',
          responseText: 'Dispatched replacement projector projector unit T-2 with dispatch driver ID MOE-008. Delivery confirmed and installation complete.',
          responderName: 'Helen Cho (Admin)',
          createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        },
        {
          id: 'TKT-1004',
          date: getRelativeDate(12), // 12 days ago
          officerName: 'Amara Diallo',
          phone: '+254 711 987 654',
          partner: 'O-tech',
          region: 'Somali Region',
          anydeskAddress: 'AD-910-384-184',
          deviceType: 'BioRugged',
          kitNumber: 'KIT-4481',
          issueDescription: 'Three learning tablets refuse to boot up, showing black screen with a battery warning logo even after full-day solar charging.',
          status: 'Done',
          responseText: 'Identified a faulty charging distributor cable in the kit trunk. Swapped the cable with a spare. Tablets are now booting and holding a charge.',
          responderName: 'Helen Cho (Admin)',
          createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        },
        {
          id: 'TKT-1005',
          date: getRelativeDate(35), // 35 days ago (different month)
          officerName: 'Grace Omwamba',
          phone: '+254 722 111 222',
          partner: 'ABH',
          region: 'Afar Region',
          anydeskAddress: 'AD-551-294-110',
          deviceType: 'Laxton',
          kitNumber: 'KIT-8822',
          issueDescription: 'Offline dictionary databases are outdated. Requesting flashing instructions for USB-drive updates.',
          status: 'Done',
          responseText: 'Sent update guides along with ZIP download link. Updates successfully applied over local USB replication.',
          responderName: 'Marcus Vance (Admin)',
          createdAt: new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 34 * 24 * 3600 * 1000).toISOString(),
        }
      ];

      // Populate memory-store initially as backup
      memoryTickets.push(...mockTickets);
      memoryHardware.push({
        id: 2345,
        date: getRelativeDate(2),
        officerName: 'Sarah Jenkins',
        phone: '+251 911 234 567',
        partner: 'Safaricom',
        region: 'Tigray Region',
        regCenterName: 'Adwa Center A',
        kitNumber: 'EID2345',
        kitType: 'Fingerprint Scanner',
        issueTypes: 'Sensor Malfunction, Connection Port Loose',
        issueDescription: 'Section 1 — User & Location Details\n\n**User Full Name:** world crown - **Phone Number:** 0990909090 - **Partner:** Ethio Tele - **Region:** Addis Ababa - **Registration Center Name:** center\n\nSection 2 — Equipment Details\n\n**Kit Number / Serial:** EID2345 - **Kit Type:** Biometric Registration Kit (BRK)\n\nSection 3 — System Issue Types\n\n**Reported Problems:** Fingerprint Scanner\n\nSection 4 — Issue Description\n\nFingerprint Scanner',
        verifiedBy: 'world crown',
        dateVerified: '2026-06-27',
        status: 'Open',
        hwIssueStatus: 'Under Repair',
        createdAt: new Date(Date.now() - 48 * 3600 * 1000),
        updatedAt: new Date(Date.now() - 48 * 3600 * 1000)
      });

      if (isSupabaseConfigured()) {
        console.log("[Supabase] Detected Supabase credentials. Verifying database...");
        const supabase = getSupabaseClient();

        // Auto-migrate issue_types from array to text if configured
        try {
          console.log("[Schema Sync] Altering issue_types column in tickets and hardware tables to be standard TEXT if they are arrays...");
          await db.execute(sql`
            DO $$
            BEGIN
              -- Alter tickets table issue_types column if it exists and is an array
              IF EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'tickets' 
                  AND column_name = 'issue_types' 
                  AND data_type = 'ARRAY'
              ) THEN
                ALTER TABLE tickets ALTER COLUMN issue_types TYPE text USING array_to_string(issue_types, ', ');
              END IF;

              -- Alter hardware table issue_types column if it exists and is an array
              IF EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'hardware' 
                  AND column_name = 'issue_types' 
                  AND data_type = 'ARRAY'
              ) THEN
                ALTER TABLE hardware ALTER COLUMN issue_types TYPE text USING array_to_string(issue_types, ', ');
              END IF;
            END $$;
          `);
          console.log("[Schema Sync] Successfully altered columns to standard TEXT.");
        } catch (syncErr: any) {
          console.warn("[Schema Sync] Local DB execution skipped or failed. This is expected if direct connection is not configured or you are on an external cloud provider. Error:", syncErr.message || syncErr);
        }

        const { data: existing, error: countError } = await supabase.from('tickets').select('id');

        if (countError) {
          console.warn("[Supabase] Failed to check existing tickets (Does 'tickets' table exist in your Supabase schema yet?). Error:", countError.message);
        } else if (!existing || existing.length === 0) {
          console.log("[Supabase] Database has 0 tickets. Seeding INITIAL_TICKETS into Supabase...");
          const mockTicketsSnake = mockTickets.map(t => mapTicketToSnakeCase(t));
          let { error: seedError } = await (supabase.from('tickets') as any).insert(mockTicketsSnake);
          if (seedError && (seedError.code === 'PGRST204' || (seedError.message && seedError.message.includes('column')))) {
            console.warn("[Supabase] Seeding failed due to missing columns, stripping and retrying...");
            const strippedMockTickets = mockTickets.map(t => {
              const row = mapTicketToSnakeCase(t);
              delete row.assigned_to;
              delete row.issue_types;
              delete row.hw_issue_status;
              delete row.hw_resolution_method;
              delete row.hw_replacement_source;
              return row;
            });
            const retryRes = await (supabase.from('tickets') as any).insert(strippedMockTickets);
            seedError = retryRes.error;
          }
          if (seedError) {
            console.error("[Supabase] Seeding failed:", seedError.message);
          } else {
            console.log("[Supabase] Successfully seeded Supabase table with initial tickets.");
          }
        } else {
          console.log(`[Supabase] Verified existing tickets table has ${existing.length} record(s).`);
        }
      } else {
        try {
          const existingCount = await db.select().from(tickets);
          if (existingCount.length === 0) {
            console.log("Database has 0 tickets. Seeding INITIAL_TICKETS...");
            for (const tkt of mockTickets) {
              await db.insert(tickets).values(tkt);
            }
            console.log("Successfully seeded database with 5 initial tickets.");
          }
        } catch (dbErr) {
          console.warn("[Seeding] Local database unavailable for seeding, using in-memory backup:", dbErr);
        }
      }
    } catch (error) {
      console.error("Critical error during self-contained database seeding:", error);
    }
  })();

  // --- API Routes ---

  // User Sync Route
  app.post("/api/auth/sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || "";
      const name = req.user?.name || email.split("@")[0] || "User";

      if (!uid) {
        return res.status(401).json({ error: "Invalid auth credentials" });
      }

      const { preferredRole, preferredUsername, partner } = req.body;

      const authorizedAdminEmails = [
        "kirubelay6@gmail.com",
        "admin@support.com",
        "belayalemzewd@gmail.com",
        "worldcrown12@gmail.com"
      ];

      const isAuthorizedAdmin = authorizedAdminEmails.includes(email.toLowerCase().trim());

      let matchedUser = null;
      const useSupabase = isSupabaseConfigured() && req.user?.aud === 'supabase';

      if (useSupabase) {
        try {
          const supabase = getSupabaseClient();
          console.log(`[Supabase] Syncing user profile for uid: ${uid}`);

          const { data: existingUser, error: fetchErr } = await supabase
            .from('users')
            .select('*')
            .eq('uid', uid)
            .maybeSingle();

          if (fetchErr) throw fetchErr;

          if (existingUser) {
            const updateParams: any = {};
            if (preferredRole) {
              updateParams.role = isAuthorizedAdmin ? "admin" : "user";
            }
            if (preferredUsername) updateParams.username = preferredUsername;
            if (partner) updateParams.partner = partner;

            if (Object.keys(updateParams).length > 0) {
              const { data: updated, error: updateErr } = await (supabase
                .from('users') as any)
                .update(updateParams)
                .eq('uid', uid)
                .select()
                .single();
              if (updateErr) throw updateErr;
              matchedUser = mapUserToCamelCase(updated);
            } else {
              matchedUser = mapUserToCamelCase(existingUser);
            }
          } else {
            const finalRole = isAuthorizedAdmin ? "admin" : "user";
            const newUser = {
              uid,
              email,
              username: preferredUsername || name,
              role: finalRole,
              partner: partner || null,
              status: "approved",
            };
            const { data: inserted, error: insertErr } = await (supabase
              .from('users') as any)
              .insert(mapUserToSnakeCase(newUser))
              .select()
              .single();
            if (insertErr) throw insertErr;
            matchedUser = mapUserToCamelCase(inserted);
          }
          if (matchedUser) {
            return res.json(matchedUser);
          }
        } catch (supabaseErr: any) {
          console.warn("[Supabase] Sync failed, falling back to Drizzle database:", supabaseErr.message || supabaseErr);
        }
      }

      // Check if user already exists in Drizzle
      let existingUser: any[] = [];
      try {
        existingUser = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      } catch (dbErr) {
        console.warn("[AuthSync] Drizzle query failed, checking memoryUsers:", dbErr);
        existingUser = memoryUsers.filter(u => u.uid === uid);
      }

      if (existingUser.length > 0) {
        // Update user if they wanted a specific role/username in transition state
        const updateParams: Partial<typeof users.$inferInsert> = {};
        if (preferredRole) {
          updateParams.role = isAuthorizedAdmin ? "admin" : "user";
        }
        if (preferredUsername) updateParams.username = preferredUsername;
        if (partner) updateParams.partner = partner;

        if (Object.keys(updateParams).length > 0) {
          try {
            const updated = await db.insert(users)
              .values({
                uid,
                email,
                username: preferredUsername || name,
                role: isAuthorizedAdmin ? "admin" : "user",
                partner: partner || null,
              })
              .onConflictDoUpdate({
                target: users.uid,
                set: updateParams,
                targetWhere: undefined,
              })
              .returning();
            matchedUser = updated[0];
          } catch (dbErr) {
            console.warn("[AuthSync] Drizzle insert/update failed, updating memoryUsers:", dbErr);
            const idx = memoryUsers.findIndex(u => u.uid === uid);
            const baseUser = memoryUsers[idx] || { uid, email, username: preferredUsername || name, role: isAuthorizedAdmin ? "admin" : "user", partner: partner || null, status: "approved" };
            const updatedUser = {
              ...baseUser,
              role: preferredRole ? (isAuthorizedAdmin ? "admin" : "user") : baseUser.role,
              username: preferredUsername || baseUser.username,
              partner: partner || baseUser.partner
            };
            if (idx >= 0) {
              memoryUsers[idx] = updatedUser;
            } else {
              memoryUsers.push(updatedUser);
            }
            matchedUser = updatedUser;
          }
        } else {
          matchedUser = existingUser[0];
        }
      } else {
        // Create new user
        const finalRole = isAuthorizedAdmin ? "admin" : "user";
        const newUserVal = {
          uid,
          email,
          username: preferredUsername || name,
          role: finalRole,
          status: "approved",
          partner: partner || null,
        };

        try {
          const inserted = await db.insert(users).values(newUserVal).returning();
          matchedUser = inserted[0];
        } catch (dbErr) {
          console.warn("[AuthSync] Drizzle insert failed, creating memoryUsers entry:", dbErr);
          memoryUsers.push(newUserVal);
          matchedUser = newUserVal;
        }
      }

      res.json(matchedUser);
    } catch (error: any) {
      console.error("Auth sync handler error:", error);
      res.status(500).json({ error: `Failed to synchronize user connection profile: ${error.message || error}` });
    }
  });

  // Find User by Email (Sandbox custom credential sign in)
  app.post("/api/auth/login-by-email", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check in Supabase first if configured
      if (isSupabaseConfigured()) {
        try {
          const supabase = getSupabaseClient();
          const { data: existingUser, error: fetchErr } = await supabase
            .from('users')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();

          if (fetchErr) throw fetchErr;
          if (existingUser) {
            const matchedUser = mapUserToCamelCase(existingUser);
            return res.json(matchedUser);
          }
        } catch (supabaseErr) {
          console.warn("[Supabase] Failed to check email in Supabase, checking Drizzle database...", supabaseErr);
        }
      }

      // Query Drizzle SQL database
      let existingUsers: any[] = [];
      try {
        existingUsers = await db.select().from(users).where(eq(users.email, email.trim())).limit(1);
      } catch (dbErr) {
        console.warn("[Login] Drizzle query failed, checking memoryUsers:", dbErr);
        existingUsers = memoryUsers.filter(u => u.email.trim().toLowerCase() === normalizedEmail);
      }

      if (existingUsers.length > 0) {
        return res.json(existingUsers[0]);
      }

      return res.status(404).json({ error: "No account found with this email. Please check your credentials or create a new account below." });
    } catch (err) {
      console.error("Login by email error:", err);
      res.status(500).json({ error: "Failed to query authentication database." });
    }
  });

  // Get Tickets List
  app.get("/api/tickets", requireAuth, async (req: AuthRequest, res) => {
    try {
      const useSupabase = isSupabaseConfigured() && req.user?.aud === 'supabase';
      if (useSupabase) {
        try {
          const supabase = getSupabaseClient();
          console.log("[Supabase] Querying tickets...");
          const { data: ticketRecords, error } = await supabase
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;

          // Fetch hardware tickets from Supabase to merge
          const { data: hwRecords, error: hwError } = await (supabase
            .from('hardware_tickets') as any)
            .select('*');

          const hwMap = new Map();
          if (!hwError && hwRecords) {
            hwRecords.forEach((r: any) => {
              hwMap.set(r.ticket_id, r);
            });
          }

          const mappedRecords = (ticketRecords || []).map(row => {
            const camel = mapTicketToCamelCase(row);
            if (hwMap.has(camel.id)) {
              const hw = hwMap.get(camel.id);
              camel.hwIssueStatus = hw.issue_status || camel.hwIssueStatus;
              camel.hwResolutionMethod = hw.resolution_method || camel.hwResolutionMethod;
              camel.hwReplacementSource = hw.replacement_source || camel.hwReplacementSource;
            }
            return camel;
          });

          // Fetch standalone hardware table records from Supabase
          const { data: standaloneHwRecords, error: standaloneHwError } = await (supabase
            .from('hardware') as any)
            .select('*');

          if (!standaloneHwError && standaloneHwRecords) {
            standaloneHwRecords.forEach((r: any) => {
              mappedRecords.push({
                id: "HW-" + r.id,
                date: r.date,
                officerName: r.officer_name,
                phone: r.phone,
                partner: r.partner,
                region: r.region,
                anydeskAddress: "N/A",
                deviceType: r.kit_type || "",
                kitNumber: r.kit_number,
                issueDescription: r.issue_description,
                status: (r.status || "Open") as any,
                hwIssueStatus: r.hw_issue_status || "Under Repair",
                hwResolutionMethod: r.hw_resolution_method || undefined,
                hwReplacementSource: r.hw_replacement_source || undefined,
                regCenterName: r.reg_center_name || undefined,
                verifiedBy: r.verified_by || undefined,
                dateVerified: r.date_verified || undefined,
                kitType: r.kit_type || undefined,
                issueTypes: Array.isArray(r.issue_types) ? r.issue_types : (typeof r.issue_types === 'string' ? r.issue_types.split(',').map((s: any) => s.trim()).filter(Boolean) : []),
                createdAt: r.created_at,
                updatedAt: r.updated_at
              } as any);
            });
          }

          mappedRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return res.json(mappedRecords);
        } catch (supabaseErr) {
          console.warn("[Supabase] Failed to get tickets from Supabase, falling back to Drizzle:", supabaseErr);
        }
      }

      // Return all tickets ordered by createdAt descending from Drizzle SQL database
      let ticketRecords: any[] = [];
      try {
        ticketRecords = await db.select().from(tickets);
      } catch (dbErr) {
        console.warn("[GetTickets] Drizzle tickets select failed, using memoryTickets:", dbErr);
        ticketRecords = [...memoryTickets];
      }

      // Fetch hardware tickets from Drizzle SQL database to merge
      let hwRecords: any[] = [];
      try {
        hwRecords = await db.select().from(hardwareTickets);
      } catch (dbErr) {
        console.warn("[GetTickets] Drizzle hardwareTickets select failed, using memoryHardwareTickets:", dbErr);
        hwRecords = [...memoryHardwareTickets];
      }

      const hwMap = new Map();
      hwRecords.forEach(r => {
        hwMap.set(r.ticketId || r.ticket_id, r);
      });

      const mapped = ticketRecords.map(t => {
        let parsedIssueTypes: string[] = [];
        if (t.issueTypes) {
          try {
            parsedIssueTypes = JSON.parse(t.issueTypes);
          } catch (e) {
            parsedIssueTypes = t.issueTypes.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }

        const camel = {
          ...t,
          issueTypes: parsedIssueTypes
        };

        if (hwMap.has(camel.id)) {
          const hw = hwMap.get(camel.id);
          camel.hwIssueStatus = hw.issueStatus || hw.issue_status || camel.hwIssueStatus;
          camel.hwResolutionMethod = hw.resolutionMethod || hw.resolution_method || camel.hwResolutionMethod;
          camel.hwReplacementSource = hw.replacementSource || hw.replacement_source || camel.hwReplacementSource;
        }

        return camel;
      });

      // Fetch standalone hardware records from Drizzle
      let drizzleHwRecords: any[] = [];
      try {
        drizzleHwRecords = await db.select().from(hardware);
      } catch (hwFetchErr) {
        console.warn("[Drizzle] Failed to fetch standalone hardware records, using memoryHardware:", hwFetchErr);
        drizzleHwRecords = [...memoryHardware];
      }

      drizzleHwRecords.forEach(h => {
        mapped.push({
          id: "HW-" + h.id,
          date: h.date,
          officerName: h.officerName || h.officer_name,
          phone: h.phone,
          partner: h.partner,
          region: h.region,
          anydeskAddress: "N/A",
          deviceType: h.kitType || h.kit_type || "",
          kitNumber: h.kitNumber || h.kit_number,
          issueDescription: h.issueDescription || h.issue_description,
          status: (h.status || "Open") as any,
          hwIssueStatus: h.hwIssueStatus || h.hw_issue_status || "Under Repair",
          hwResolutionMethod: h.hwResolutionMethod || h.hw_resolution_method || undefined,
          hwReplacementSource: h.hwReplacementSource || h.hw_replacement_source || undefined,
          regCenterName: h.regCenterName || h.reg_center_name || undefined,
          verifiedBy: h.verifiedBy || h.verified_by || undefined,
          dateVerified: h.dateVerified || h.date_verified || undefined,
          kitType: h.kitType || h.kit_type || undefined,
          issueTypes: typeof h.issueTypes === 'string' ? h.issueTypes.split(',').map((s: string) => s.trim()).filter(Boolean) : (Array.isArray(h.issueTypes) ? h.issueTypes : []),
          createdAt: h.createdAt && h.createdAt.toISOString ? h.createdAt.toISOString() : String(h.createdAt || new Date()),
          updatedAt: h.updatedAt && h.updatedAt.toISOString ? h.updatedAt.toISOString() : String(h.updatedAt || new Date()),
        } as any);
      });

      mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(mapped);
    } catch (error: any) {
      console.error("Get tickets error:", error);
      res.status(500).json({ error: `Database query failed to fetch ticket records: ${error.message || error}` });
    }
  });

  // Create Ticket
  app.post("/api/tickets", requireAuth, async (req: AuthRequest, res) => {
    try {
      const ticketData = req.body;
      const timestampIso = new Date().toISOString();
      const isHardwareForm = ticketData.issueDescription?.includes('HARDWARE ISSUE REPORTING FORM') || ticketData.regCenterName !== undefined;

      const useSupabase = isSupabaseConfigured() && req.user?.aud === 'supabase';

      if (isHardwareForm) {
        let insertedIntoSupabase = false;
        let insertedRecord: any = null;

        if (useSupabase) {
          try {
            const supabase = getSupabaseClient();
            console.log(`[Supabase] Saving new hardware reporting form into 'hardware' table`);
            const { data: results, error: hwInsertErr } = await (supabase
              .from('hardware') as any)
              .insert({
                date: ticketData.date || new Date().toISOString().split('T')[0],
                officer_name: ticketData.officerName,
                phone: ticketData.phone,
                partner: ticketData.partner,
                region: ticketData.region,
                reg_center_name: ticketData.regCenterName || null,
                kit_number: ticketData.kitNumber,
                kit_type: ticketData.kitType || ticketData.deviceType || null,
                issue_types: ticketData.issueTypes ? (
                  isHardwareIssueTypesArray ? (
                    Array.isArray(ticketData.issueTypes) ? ticketData.issueTypes : ticketData.issueTypes.split(',').map((s: string) => s.trim()).filter(Boolean)
                  ) : (
                    Array.isArray(ticketData.issueTypes) ? ticketData.issueTypes.join(', ') : ticketData.issueTypes
                  )
                ) : null,
                issue_description: ticketData.issueDescription,
                verified_by: ticketData.verifiedBy || null,
                date_verified: ticketData.dateVerified || null,
                status: "Open",
                hw_issue_status: "Under Repair",
                hw_resolution_method: null,
                hw_replacement_source: null
              })
              .select();

            if (hwInsertErr) throw hwInsertErr;
            if (results && results[0]) {
              insertedRecord = results[0];
              insertedIntoSupabase = true;
            }
          } catch (supabaseErr) {
            console.warn("[Supabase] Failed to insert hardware form into Supabase 'hardware' table, falling back to Drizzle:", supabaseErr);
          }
        }

        if (!insertedIntoSupabase) {
          console.log(`[Drizzle] Saving new hardware reporting form into 'hardware' table`);
          try {
            const inserted = await db.insert(hardware).values({
              date: ticketData.date || new Date().toISOString().split('T')[0],
              officerName: ticketData.officerName,
              phone: ticketData.phone,
              partner: ticketData.partner,
              region: ticketData.region,
              regCenterName: ticketData.regCenterName || null,
              kitNumber: ticketData.kitNumber,
              kitType: ticketData.kitType || ticketData.deviceType || null,
              issueTypes: ticketData.issueTypes ? (Array.isArray(ticketData.issueTypes) ? ticketData.issueTypes.join(', ') : ticketData.issueTypes) : null,
              issueDescription: ticketData.issueDescription,
              verifiedBy: ticketData.verifiedBy || null,
              dateVerified: ticketData.dateVerified || null,
              status: "Open",
              hwIssueStatus: "Under Repair",
              hwResolutionMethod: null,
              hwReplacementSource: null,
              createdAt: new Date(),
              updatedAt: new Date()
            }).returning();

            insertedRecord = inserted[0];
          } catch (dbErr) {
            console.warn("[Drizzle] Hardware insertion failed, falling back to memoryHardware:", dbErr);
            const memoryId = memoryHardware.length > 0 ? Math.max(...memoryHardware.map(h => h.id)) + 1 : 1;
            const newHw = {
              id: memoryId,
              date: ticketData.date || new Date().toISOString().split('T')[0],
              officerName: ticketData.officerName,
              phone: ticketData.phone,
              partner: ticketData.partner,
              region: ticketData.region,
              regCenterName: ticketData.regCenterName || null,
              kitNumber: ticketData.kitNumber,
              kitType: ticketData.kitType || ticketData.deviceType || null,
              issueTypes: ticketData.issueTypes ? (Array.isArray(ticketData.issueTypes) ? ticketData.issueTypes.join(', ') : ticketData.issueTypes) : null,
              issueDescription: ticketData.issueDescription,
              verifiedBy: ticketData.verifiedBy || null,
              dateVerified: ticketData.dateVerified || null,
              status: "Open",
              hwIssueStatus: "Under Repair",
              hwResolutionMethod: null,
              hwReplacementSource: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            memoryHardware.push(newHw);
            insertedRecord = newHw;
          }
        }

        if (insertedRecord) {
          const formattedResponse = {
            id: "HW-" + insertedRecord.id,
            date: insertedRecord.date,
            officerName: insertedRecord.officerName || insertedRecord.officer_name,
            phone: insertedRecord.phone,
            partner: insertedRecord.partner,
            region: insertedRecord.region,
            anydeskAddress: "N/A",
            deviceType: insertedRecord.kitType || insertedRecord.kit_type || "",
            kitNumber: insertedRecord.kitNumber || insertedRecord.kit_number,
            issueDescription: insertedRecord.issueDescription || insertedRecord.issue_description,
            status: "Open" as any,
            hwIssueStatus: insertedRecord.hwIssueStatus || insertedRecord.hw_issue_status || "Under Repair",
            hwResolutionMethod: insertedRecord.hwResolutionMethod || insertedRecord.hw_resolution_method || null,
            hwReplacementSource: insertedRecord.hwReplacementSource || insertedRecord.hw_replacement_source || null,
            regCenterName: insertedRecord.regCenterName || insertedRecord.reg_center_name || null,
            verifiedBy: insertedRecord.verifiedBy || insertedRecord.verified_by || null,
            dateVerified: insertedRecord.dateVerified || insertedRecord.date_verified || null,
            kitType: insertedRecord.kitType || insertedRecord.kit_type || null,
            issueTypes: ticketData.issueTypes || [],
            createdAt: insertedRecord.createdAt || insertedRecord.created_at || timestampIso,
            updatedAt: insertedRecord.updatedAt || insertedRecord.updated_at || timestampIso,
          };
          return res.status(201).json(formattedResponse);
        } else {
          throw new Error("Failed to insert hardware record.");
        }
      }

      // Standard Ticket Logic
      let nextId = "";

      // Get the highest current ticket ID to avoid primary key collisions
      let maxNum = 1000;
      if (useSupabase) {
        try {
          const supabase = getSupabaseClient();
          console.log("[Supabase] Generating ticket ID...");
          const { data: allTkts, error: countErr } = await supabase.from('tickets').select('id');
          if (countErr) throw countErr;
          (allTkts || []).forEach((t: any) => {
            const match = t.id.match(/^TKT-(\d+)$/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNum) maxNum = num;
            }
          });
        } catch (supabaseErr) {
          console.warn("[Supabase] Failed to count Supabase tickets for generating ticket ID:", supabaseErr);
        }
      }

      // Always query Drizzle to ensure we also take local database tickets into account
      try {
        const allTkts = await db.select().from(tickets);
        allTkts.forEach(t => {
          const match = t.id.match(/^TKT-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        });
      } catch (drizzleErr) {
        console.warn("[Drizzle] Failed to count tickets for generating ticket ID:", drizzleErr);
      }

      // Also check memory tickets
      memoryTickets.forEach(t => {
        const match = t.id.match(/^TKT-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });

      nextId = "TKT-" + (maxNum + 1);

      const newTicket: any = {
        id: nextId,
        date: ticketData.date || new Date().toISOString().split('T')[0],
        officerName: ticketData.officerName,
        phone: ticketData.phone,
        partner: ticketData.partner,
        region: ticketData.region,
        anydeskAddress: ticketData.anydeskAddress,
        deviceType: ticketData.deviceType,
        kitNumber: ticketData.kitNumber,
        issueDescription: ticketData.issueDescription,
        status: "Open",
        assignedTo: ticketData.assignedTo || null,
        issueTypes: ticketData.issueTypes ? (Array.isArray(ticketData.issueTypes) ? ticketData.issueTypes.join(', ') : ticketData.issueTypes) : null,
        hwIssueStatus: ticketData.hwIssueStatus || null,
        hwResolutionMethod: ticketData.hwResolutionMethod || null,
        hwReplacementSource: ticketData.hwReplacementSource || null,
        createdAt: timestampIso,
        updatedAt: timestampIso,
      };

      let insertedIntoSupabase = false;
      if (useSupabase) {
        try {
          const supabase = getSupabaseClient();
          console.log(`[Supabase] Saving new ticket ${nextId}`);

          const insertPayload = mapTicketToSnakeCase(newTicket);
          delete insertPayload.hw_issue_status;
          delete insertPayload.hw_resolution_method;
          delete insertPayload.hw_replacement_source;

          let { error: insertErr } = await (supabase
            .from('tickets') as any)
            .insert(insertPayload);

          if (insertErr && (insertErr.code === 'PGRST204' || (insertErr.message && insertErr.message.includes('column')))) {
            console.warn("[Supabase] Insert failed due to missing columns, stripping more and retrying...", insertErr);
            delete insertPayload.assigned_to;
            delete insertPayload.issue_types;

            console.log("[Supabase] Retrying insert with stripped payload:", insertPayload);
            const retryRes = await (supabase
              .from('tickets') as any)
              .insert(insertPayload);
            insertErr = retryRes.error;
          }

          if (insertErr) throw insertErr;
          insertedIntoSupabase = true;
        } catch (supabaseErr) {
          console.warn("[Supabase] Failed to insert into Supabase, falling back to Drizzle:", supabaseErr);
        }
      }

      if (!insertedIntoSupabase) {
        try {
          await db.insert(tickets).values(newTicket);
        } catch (dbErr) {
          console.warn("[Drizzle] Tickets insertion failed, falling back to memoryTickets:", dbErr);
          memoryTickets.push(newTicket);
        }
      }

      res.status(201).json({
        ...newTicket,
        issueTypes: ticketData.issueTypes || []
      });
    } catch (error: any) {
      console.error("Create ticket error:", error);
      res.status(500).json({ error: `Database failed to persist new ticket: ${error.message || error}` });
    }
  });

  // Update Ticket (status, responder name, response text)
  app.post("/api/tickets/:id/update", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updatedFields = req.body;

      const useSupabase = isSupabaseConfigured() && req.user?.aud === 'supabase';

      const isHardwareId = id.startsWith("HW-");
      if (isHardwareId) {
        const trueId = parseInt(id.replace("HW-", ""), 10);
        let updatedInSupabase = false;
        let row: any = null;

        if (useSupabase) {
          try {
            const supabase = getSupabaseClient();
            const { data: existingHw, error: checkErr } = await supabase
              .from('hardware')
              .select('*')
              .eq('id', trueId)
              .maybeSingle();

            if (checkErr) throw checkErr;
            if (!existingHw) {
              return res.status(404).json({ error: "Hardware ticket not found." });
            }

            const timestampIso = new Date().toISOString();
            const updatePayload: any = {
              updated_at: timestampIso,
            };

            if (updatedFields.status !== undefined) updatePayload.status = updatedFields.status;
            if (updatedFields.hwIssueStatus !== undefined) updatePayload.hw_issue_status = updatedFields.hwIssueStatus;
            if (updatedFields.hwResolutionMethod !== undefined) updatePayload.hw_resolution_method = updatedFields.hwResolutionMethod;
            if (updatedFields.hwReplacementSource !== undefined) updatePayload.hw_replacement_source = updatedFields.hwReplacementSource;

            const { data: updatedRecord, error: updateErr } = await (supabase
              .from('hardware') as any)
              .update(updatePayload)
              .eq('id', trueId)
              .select()
              .maybeSingle();

            if (updateErr) throw updateErr;

            row = updatedRecord || existingHw;
            updatedInSupabase = true;
          } catch (supabaseErr) {
            console.warn("[Supabase] Failed to update hardware ticket on Supabase, falling back to Drizzle:", supabaseErr);
          }
        }

        if (!updatedInSupabase) {
          let existingRecord: any[] = [];
          try {
            existingRecord = await db.select().from(hardware).where(eq(hardware.id, trueId)).limit(1);
          } catch (dbErr) {
            console.warn("[Drizzle] Hardware select failed, using memoryHardware:", dbErr);
            existingRecord = memoryHardware.filter(h => h.id === trueId);
          }

          if (existingRecord.length === 0) {
            return res.status(404).json({ error: "Hardware ticket not found." });
          }

          const updatePayload: any = {
            updatedAt: new Date(),
          };

          if (updatedFields.status !== undefined) updatePayload.status = updatedFields.status;
          if (updatedFields.hwIssueStatus !== undefined) updatePayload.hwIssueStatus = updatedFields.hwIssueStatus;
          if (updatedFields.hwResolutionMethod !== undefined) updatePayload.hwResolutionMethod = updatedFields.hwResolutionMethod;
          if (updatedFields.hwReplacementSource !== undefined) updatePayload.hwReplacementSource = updatedFields.hwReplacementSource;

          try {
            await db.update(hardware)
              .set(updatePayload)
              .where(eq(hardware.id, trueId));

            const updatedRecord = await db.select().from(hardware).where(eq(hardware.id, trueId)).limit(1);
            row = updatedRecord[0];
          } catch (dbErr) {
            console.warn("[Drizzle] Hardware update failed, using memoryHardware fallback:", dbErr);
            const idx = memoryHardware.findIndex(h => h.id === trueId);
            if (idx >= 0) {
              const updatedRow = {
                ...memoryHardware[idx],
                ...updatePayload,
                updatedAt: new Date()
              };
              memoryHardware[idx] = updatedRow;
              row = updatedRow;
            } else {
              return res.status(404).json({ error: "Hardware ticket not found in memory." });
            }
          }
        }

        const camel = {
          id: "HW-" + (row.id || trueId),
          date: row.date,
          officerName: row.officerName || row.officer_name,
          phone: row.phone,
          partner: row.partner,
          region: row.region,
          anydeskAddress: "N/A",
          deviceType: row.kitType || row.kit_type || "",
          kitNumber: row.kitNumber || row.kit_number,
          issueDescription: row.issueDescription || row.issue_description,
          status: (row.status || "Open") as any,
          hwIssueStatus: row.hwIssueStatus || row.hw_issue_status || "Under Repair",
          hwResolutionMethod: row.hwResolutionMethod || row.hw_resolution_method || undefined,
          hwReplacementSource: row.hwReplacementSource || row.hw_replacement_source || undefined,
          regCenterName: row.regCenterName || row.reg_center_name || undefined,
          verifiedBy: row.verifiedBy || row.verified_by || undefined,
          dateVerified: row.dateVerified || row.date_verified || undefined,
          kitType: row.kitType || row.kit_type || undefined,
          issueTypes: typeof row.issueTypes === 'string' ? row.issueTypes.split(',').map((s: string) => s.trim()).filter(Boolean) : (Array.isArray(row.issue_types) ? row.issue_types : []),
          createdAt: row.createdAt || row.created_at,
          updatedAt: row.updatedAt || row.updated_at
        };
        return res.json(camel);
      }

      let updatedInSupabase = false;

      if (useSupabase) {
        try {
          const supabase = getSupabaseClient();
          const { data: existingRecord, error: checkErr } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (checkErr) throw checkErr;
          if (!existingRecord) {
            return res.status(404).json({ error: "Ticket not found." });
          }

          const timestampIso = new Date().toISOString();
          const updatePayload: any = {
            updated_at: timestampIso,
          };

          if (updatedFields.status !== undefined) updatePayload.status = updatedFields.status;
          if (updatedFields.responseText !== undefined) updatePayload.response_text = updatedFields.responseText;
          if (updatedFields.responderName !== undefined) updatePayload.responder_name = updatedFields.responderName;

          // Set direct columns in Supabase
          if (updatedFields.assignedTo !== undefined) {
            updatePayload.assigned_to = updatedFields.assignedTo;
          }
          if (updatedFields.issueTypes !== undefined) {
            if (isTicketsIssueTypesArray) {
              updatePayload.issue_types = updatedFields.issueTypes ? (Array.isArray(updatedFields.issueTypes) ? updatedFields.issueTypes : updatedFields.issueTypes.split(',').map((s: string) => s.trim()).filter(Boolean)) : [];
            } else {
              updatePayload.issue_types = updatedFields.issueTypes ? (Array.isArray(updatedFields.issueTypes) ? updatedFields.issueTypes.join(', ') : updatedFields.issueTypes) : null;
            }
          }

          // Clean up legacy metadata block in issue_description if present
          const existingRecordAny = existingRecord as any;
          const existingCamel = mapTicketToCamelCase(existingRecordAny);
          if (existingRecordAny && existingRecordAny.issue_description && existingRecordAny.issue_description.includes('\n\n---METADATA---\n')) {
            updatePayload.issue_description = existingCamel.issueDescription;
          }

          let updatedRecord: any = null;
          let updateErr: any = null;

          const initialRes = await (supabase
            .from('tickets') as any)
            .update(updatePayload)
            .eq('id', id)
            .select()
            .maybeSingle();

          if (initialRes.error) {
            updateErr = initialRes.error;
            // Check if error is due to missing columns in Supabase
            if (updateErr.code === 'PGRST204' || (updateErr.message && updateErr.message.includes('column'))) {
              console.warn("[Supabase] Update failed due to missing columns, stripping and retrying...", updateErr);
              const strippedPayload = { ...updatePayload };
              delete strippedPayload.assigned_to;
              delete strippedPayload.issue_types;

              console.log("[Supabase] Retrying update with stripped payload:", strippedPayload);
              const retryRes = await (supabase
                .from('tickets') as any)
                .update(strippedPayload)
                .eq('id', id)
                .select()
                .maybeSingle();

              if (!retryRes.error) {
                updatedRecord = retryRes.data;
                updateErr = null;
              } else {
                updateErr = retryRes.error;
              }
            }
          } else {
            updatedRecord = initialRes.data;
          }

          if (updateErr) throw updateErr;

          // Update/upsert the hardware_tickets table in Supabase
          if (updatedFields.hwIssueStatus !== undefined ||
            updatedFields.hwResolutionMethod !== undefined ||
            updatedFields.hwReplacementSource !== undefined) {

            console.log(`[Supabase] Updating hardware_tickets for ticket ${id}`);
            const { data: existingHw } = await (supabase
              .from('hardware_tickets') as any)
              .select('id')
              .eq('ticket_id', id)
              .maybeSingle();

            const hwPayload: any = {
              updated_at: timestampIso
            };
            if (updatedFields.hwIssueStatus !== undefined) hwPayload.issue_status = updatedFields.hwIssueStatus;
            if (updatedFields.hwResolutionMethod !== undefined) hwPayload.resolution_method = updatedFields.hwResolutionMethod;
            if (updatedFields.hwReplacementSource !== undefined) hwPayload.replacement_source = updatedFields.hwReplacementSource;

            if (existingHw) {
              const { error: updateHwErr } = await (supabase
                .from('hardware_tickets') as any)
                .update(hwPayload)
                .eq('ticket_id', id);
              if (updateHwErr) console.error("[Supabase] Failed to update hardware_tickets:", updateHwErr);
            } else {
              hwPayload.ticket_id = id;
              const { error: insertHwErr } = await (supabase
                .from('hardware_tickets') as any)
                .insert(hwPayload);
              if (insertHwErr) console.error("[Supabase] Failed to insert into hardware_tickets:", insertHwErr);
            }
          }

          // Fetch merged hardware fields to return accurate camelCase state
          const { data: updatedHwRecord } = await (supabase
            .from('hardware_tickets') as any)
            .select('*')
            .eq('ticket_id', id)
            .maybeSingle();

          const finalCamel = mapTicketToCamelCase(updatedRecord || existingRecord);
          if (updatedHwRecord) {
            finalCamel.hwIssueStatus = updatedHwRecord.issue_status;
            finalCamel.hwResolutionMethod = updatedHwRecord.resolution_method;
            finalCamel.hwReplacementSource = updatedHwRecord.replacement_source;
          }

          updatedInSupabase = true;
          return res.json(finalCamel);
        } catch (supabaseErr) {
          console.warn("[Supabase] Failed to update ticket on Supabase, falling back to Drizzle:", supabaseErr);
        }
      }

      let existingRecord: any[] = [];
      try {
        existingRecord = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
      } catch (dbErr) {
        console.warn("[Drizzle] Tickets select failed, using memoryTickets:", dbErr);
        existingRecord = memoryTickets.filter(t => t.id === id);
      }

      if (existingRecord.length === 0) {
        return res.status(404).json({ error: "Ticket not found." });
      }

      const timestampIso = new Date().toISOString();
      const updatePayload: Partial<typeof tickets.$inferInsert> = {
        updatedAt: timestampIso,
      };

      if (updatedFields.status !== undefined) updatePayload.status = updatedFields.status;
      if (updatedFields.responseText !== undefined) updatePayload.responseText = updatedFields.responseText;
      if (updatedFields.responderName !== undefined) updatePayload.responderName = updatedFields.responderName;
      if (updatedFields.assignedTo !== undefined) updatePayload.assignedTo = updatedFields.assignedTo;
      if (updatedFields.issueTypes !== undefined) updatePayload.issueTypes = updatedFields.issueTypes ? (Array.isArray(updatedFields.issueTypes) ? updatedFields.issueTypes.join(', ') : updatedFields.issueTypes) : null;

      let outputRecord = existingRecord[0];

      // Update core ticket in db
      try {
        await db.update(tickets)
          .set(updatePayload)
          .where(eq(tickets.id, id));

        const updatedRecord = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
        outputRecord = updatedRecord[0];
      } catch (dbErr) {
        console.warn("[Drizzle] Tickets update failed, updating memoryTickets:", dbErr);
        const idx = memoryTickets.findIndex(t => t.id === id);
        if (idx >= 0) {
          const updatedRow = {
            ...memoryTickets[idx],
            ...updatePayload,
            updatedAt: timestampIso
          };
          memoryTickets[idx] = updatedRow;
          outputRecord = updatedRow;
        }
      }

      // Update/upsert the hardware_tickets table in Drizzle
      let hw: any = null;
      if (updatedFields.hwIssueStatus !== undefined ||
        updatedFields.hwResolutionMethod !== undefined ||
        updatedFields.hwReplacementSource !== undefined) {

        console.log(`[Drizzle] Updating hardware_tickets for ticket ${id}`);
        const hwPayload: any = {
          updatedAt: new Date()
        };
        if (updatedFields.hwIssueStatus !== undefined) hwPayload.issueStatus = updatedFields.hwIssueStatus;
        if (updatedFields.hwResolutionMethod !== undefined) hwPayload.resolutionMethod = updatedFields.hwResolutionMethod;
        if (updatedFields.hwReplacementSource !== undefined) hwPayload.replacementSource = updatedFields.hwReplacementSource;

        try {
          const existingHw = await db.select().from(hardwareTickets).where(eq(hardwareTickets.ticketId, id)).limit(1);
          if (existingHw.length > 0) {
            await db.update(hardwareTickets)
              .set(hwPayload)
              .where(eq(hardwareTickets.ticketId, id));
          } else {
            hwPayload.ticketId = id;
            await db.insert(hardwareTickets).values(hwPayload);
          }
          const hwRecords = await db.select().from(hardwareTickets).where(eq(hardwareTickets.ticketId, id)).limit(1);
          hw = hwRecords[0];
        } catch (dbErr) {
          console.warn("[Drizzle] hardwareTickets update/insert failed, updating memoryHardwareTickets:", dbErr);
          const idx = memoryHardwareTickets.findIndex(r => r.ticketId === id);
          if (idx >= 0) {
            const updatedHw = {
              ...memoryHardwareTickets[idx],
              ...hwPayload,
              updatedAt: new Date()
            };
            memoryHardwareTickets[idx] = updatedHw;
            hw = updatedHw;
          } else {
            const newHw = {
              id: Math.random().toString(),
              ticketId: id,
              ...hwPayload,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            memoryHardwareTickets.push(newHw);
            hw = newHw;
          }
        }
      } else {
        // Just fetch existing hardware ticket to return
        try {
          const hwRecords = await db.select().from(hardwareTickets).where(eq(hardwareTickets.ticketId, id)).limit(1);
          hw = hwRecords[0];
        } catch (dbErr) {
          console.warn("[Drizzle] hardwareTickets select failed, checking memoryHardwareTickets:", dbErr);
          hw = memoryHardwareTickets.find(r => r.ticketId === id);
        }
      }

      let pTypes: string[] = [];
      if (outputRecord && outputRecord.issueTypes) {
        try {
          pTypes = JSON.parse(outputRecord.issueTypes);
        } catch (e) {
          pTypes = outputRecord.issueTypes.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }

      const resObj: any = {
        ...outputRecord,
        issueTypes: pTypes
      };
      if (hw) {
        resObj.hwIssueStatus = hw.issueStatus || hw.issue_status || undefined;
        resObj.hwResolutionMethod = hw.resolutionMethod || hw.resolution_method || undefined;
        resObj.hwReplacementSource = hw.replacementSource || hw.replacement_source || undefined;
      }

      res.json(resObj);
    } catch (error: any) {
      console.error("Update ticket error:", error);
      res.status(500).json({ error: `Database failed to update ticket: ${error.message || error}` });
    }
  });

  // Delete Ticket (Admin feature)
  app.delete("/api/tickets/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const useSupabase = isSupabaseConfigured() && req.user?.aud === 'supabase';

      const isHardwareId = id.startsWith("HW-");
      if (isHardwareId) {
        const trueId = parseInt(id.replace("HW-", ""), 10);
        let deletedInSupabase = false;

        if (useSupabase) {
          try {
            const supabase = getSupabaseClient();
            console.log(`[Supabase] Deleting hardware ticket ${trueId}`);
            const { error: deleteErr } = await (supabase
              .from('hardware') as any)
              .delete()
              .eq('id', trueId);

            if (deleteErr) throw deleteErr;
            deletedInSupabase = true;
          } catch (supabaseErr) {
            console.warn("[Supabase] Failed to delete hardware ticket on Supabase, falling back to Drizzle:", supabaseErr);
          }
        }

        console.log(`[Drizzle] Deleting hardware ticket ${trueId}`);
        try {
          await db.delete(hardware).where(eq(hardware.id, trueId));
        } catch (dbErr) {
          console.warn("[Drizzle] Hardware delete failed, using memoryHardware fallback:", dbErr);
          const idx = memoryHardware.findIndex(h => h.id === trueId);
          if (idx >= 0) {
            memoryHardware.splice(idx, 1);
          }
        }
        return res.json({ success: true, message: `Hardware ticket ${id} deleted successfully.` });
      }

      let deletedInSupabase = false;

      if (useSupabase) {
        try {
          const supabase = getSupabaseClient();
          const { data: existingRecord, error: checkErr } = await supabase
            .from('tickets')
            .select('id')
            .eq('id', id)
            .maybeSingle();

          if (checkErr) throw checkErr;
          if (!existingRecord) {
            return res.status(404).json({ error: "Ticket not found." });
          }

          // Delete linked hardware ticket records explicitly
          const { error: deleteHwErr } = await (supabase
            .from('hardware_tickets') as any)
            .delete()
            .eq('ticket_id', id);
          if (deleteHwErr) {
            console.warn("[Supabase] Failed to delete linked hardware ticket record:", deleteHwErr);
          }

          const { error: deleteErr } = await supabase
            .from('tickets')
            .delete()
            .eq('id', id);

          if (deleteErr) throw deleteErr;
          deletedInSupabase = true;
          return res.json({ success: true, message: `Ticket ${id} deleted successfully.` });
        } catch (supabaseErr) {
          console.warn("[Supabase] Failed to delete ticket on Supabase, falling back to Drizzle:", supabaseErr);
        }
      }

      // Let's find first
      let existingRecord: any[] = [];
      try {
        existingRecord = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
      } catch (dbErr) {
        console.warn("[Drizzle] Tickets select failed, checking memoryTickets:", dbErr);
        existingRecord = memoryTickets.filter(t => t.id === id);
      }

      if (existingRecord.length === 0) {
        return res.status(404).json({ error: "Ticket not found." });
      }

      // Delete any associated hardware tickets first as a fallback/safeguard
      try {
        await db.delete(hardwareTickets).where(eq(hardwareTickets.ticketId, id));
      } catch (hwDelErr) {
        console.warn("[Drizzle] Failed to delete linked hardware ticket record, using memoryHardwareTickets fallback:", hwDelErr);
        const idx = memoryHardwareTickets.findIndex(r => r.ticketId === id);
        if (idx >= 0) {
          memoryHardwareTickets.splice(idx, 1);
        }
      }

      // Perform deletion (using schema structure)
      try {
        const query = db.delete(tickets).where(eq(tickets.id, id));
        await query;
      } catch (dbErr) {
        console.warn("[Drizzle] Tickets delete failed, using memoryTickets fallback:", dbErr);
        const idx = memoryTickets.findIndex(t => t.id === id);
        if (idx >= 0) {
          memoryTickets.splice(idx, 1);
        }
      }

      res.json({ success: true, message: `Ticket ${id} deleted successfully.` });
    } catch (error: any) {
      console.error("Delete ticket error:", error);
      res.status(500).json({ error: `Database failed to delete ticket: ${error.message || error}` });
    }
  });

  // Suggest Reply via Gemini AI
  app.post("/api/tickets/suggest-reply", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { issueDescription, anydeskAddress, deviceType, partner, region } = req.body;
      if (!issueDescription) {
        return res.status(400).json({ error: "Missing required parameter: issueDescription" });
      }

      const ai = getGeminiClient();

      const systemInstruction =
        "You are an empathetic, highly technical support administrator for a digital education and infrastructure system representing " +
        "various partner agencies across regions. " +
        "Analyze the provided technical support ticket details and generate a professional, empathetic, and constructive draft " +
        "response. The response should be concise (2 to 4 sentences), clear, outline diagnostic or resolution steps, and directly " +
        "address the supervisor's technical issue. Maintain a friendly and reassuring support tone.";

      const prompt = `Ticket Details:
- Remote Node ID: ${anydeskAddress || "N/A"}
- Hardware Specs/Device: ${deviceType || "N/A"}
- Partner Agency: ${partner || "N/A"}
- Region: ${region || "N/A"}
- Technical Issue Statement: "${issueDescription}"

Please generate a professional, empathetic support reply draft. Avoid placeholders; instead, mention the exact agency/partner or region if appropriate, or suggest likely diagnostic steps based on the hardware model described.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      const suggestion = response.text || "";
      res.json({ suggestion });
    } catch (error: any) {
      console.error("Gemini suggestion error:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI suggestion. Make sure GEMINI_API_KEY is configured in your Settings." });
    }
  });

  // Analyze technical issue from an uploaded photo/image using Gemini
  app.post("/api/tickets/analyze-image", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Missing required parameter: image" });
      }

      let rawBase64 = image;
      let resolvedMimeType = mimeType || "image/jpeg";

      if (image.includes(";base64,")) {
        const parts = image.split(";base64,");
        rawBase64 = parts[1];
        const mimePart = parts[0].match(/data:(.*)/);
        if (mimePart && mimePart[1]) {
          resolvedMimeType = mimePart[1];
        }
      }

      const ai = getGeminiClient();

      console.log(`[Gemini] Requesting image analysis... base64 size: ${rawBase64.length}, mimeType: ${resolvedMimeType}`);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              data: rawBase64,
              mimeType: resolvedMimeType
            }
          },
          "You are an expert hardware and software field engineer describing an issue detected at a site for a digital school or micro-server kit. " +
          "Look at this image of a technical error, faulty hardware component, device display screens, or structural support setup. " +
          "Formulate a professional and clear 'Issue Description' for a support ticket. " +
          "The description must be concise (approx 2 to 4 sentences), detailed (specify active symptoms, apparent physical indicators, color, error texts or loose/burnt wires if any), and ready to be directly logged as the Issue Description. " +
          "Avoid boilerplate introductions or placeholders. Write only the actual technical problem statement itself."
        ]
      });

      const description = response.text || "No descriptive output was generated by Gemini.";
      res.json({ description: description.replace(/^(Issue Description:|Description:)\s*/i, '').trim() });
    } catch (error: any) {
      console.error("Gemini image analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze image using Gemini." });
    }
  });

  // --- Vite Dev Server Middleware setup ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "localhost", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
