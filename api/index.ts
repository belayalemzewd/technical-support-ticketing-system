// Vercel Serverless API Handler
// This file wraps the Express app from server.ts for Vercel's serverless environment.
// Vercel calls this file as a serverless function for all /api/* requests.

import express from "express";
import * as dotenv from "dotenv";
import { requireAuth, AuthRequest } from "../src/middleware/auth";
import {
  isSupabaseConfigured,
  getSupabaseClient,
  mapUserToCamelCase,
  mapTicketToCamelCase,
  mapTicketToSnakeCase,
} from "../src/lib/supabase-client";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json({ limit: "15mb" }));

// ===== Lazy Gemini Client =====
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// ===== AUTH: Login by Email =====
app.post("/api/auth/login-by-email", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data: existingUser, error: fetchErr } = await supabase
          .from("users")
          .select("*")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (existingUser) {
          return res.json(mapUserToCamelCase(existingUser));
        }
      } catch (supabaseErr) {
        console.warn("[Supabase] Failed to check email:", supabaseErr);
      }
    }

    return res
      .status(404)
      .json({ error: "No account found with this email. Please check your credentials or create a new account." });
  } catch (err) {
    console.error("Login by email error:", err);
    res.status(500).json({ error: "Failed to query authentication database." });
  }
});

// ===== AUTH: Sync User =====
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
      "worldcrown12@gmail.com",
    ];
    const isAuthorizedAdmin = authorizedAdminEmails.includes(email.toLowerCase().trim());

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data: existingUser, error: fetchErr } = await supabase
          .from("users")
          .select("*")
          .eq("uid", uid)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (existingUser) {
          const updateParams: any = {};
          if (preferredRole) updateParams.role = isAuthorizedAdmin ? "admin" : "user";
          if (preferredUsername) updateParams.username = preferredUsername;
          if (partner) updateParams.partner = partner;

          if (Object.keys(updateParams).length > 0) {
            const { data: updated, error: updateErr } = await supabase
              .from("users")
              .update(updateParams)
              .eq("uid", uid)
              .select()
              .single();
            if (updateErr) throw updateErr;
            return res.json(mapUserToCamelCase(updated));
          }
          return res.json(mapUserToCamelCase(existingUser));
        } else {
          const newUser = {
            uid,
            email,
            username: preferredUsername || name,
            role: isAuthorizedAdmin ? "admin" : "user",
            status: "approved",
            partner: partner || null,
          };
          const { data: inserted, error: insertErr } = await supabase
            .from("users")
            .insert(newUser)
            .select()
            .single();
          if (insertErr) throw insertErr;
          return res.json(mapUserToCamelCase(inserted));
        }
      } catch (supabaseErr: any) {
        console.warn("[Supabase] Auth sync failed:", supabaseErr.message);
        return res.status(500).json({ error: "Failed to sync user: " + supabaseErr.message });
      }
    }

    return res.status(503).json({ error: "Database not configured." });
  } catch (error: any) {
    console.error("Auth sync error:", error);
    res.status(500).json({ error: `Failed to sync user: ${error.message}` });
  }
});

// ===== TICKETS: Get All =====
app.get("/api/tickets", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("tickets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return res.json((data || []).map(mapTicketToCamelCase));
    }
    res.json([]);
  } catch (error: any) {
    console.error("Get tickets error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===== TICKETS: Create =====
app.post("/api/tickets", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const ticketData = mapTicketToSnakeCase(req.body);
      const { data, error } = await supabase.from("tickets").insert(ticketData).select().single();
      if (error) throw error;
      return res.json(mapTicketToCamelCase(data));
    }
    res.status(503).json({ error: "Database not configured." });
  } catch (error: any) {
    console.error("Create ticket error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===== TICKETS: Update =====
app.post("/api/tickets/:id/update", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const ticketData = mapTicketToSnakeCase(req.body);
      const { data, error } = await supabase.from("tickets").update(ticketData).eq("id", id).select().single();
      if (error) throw error;
      return res.json(mapTicketToCamelCase(data));
    }
    res.status(503).json({ error: "Database not configured." });
  } catch (error: any) {
    console.error("Update ticket error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===== TICKETS: Delete =====
app.delete("/api/tickets/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("tickets").delete().eq("id", id);
      if (error) throw error;
      return res.json({ success: true, message: "Ticket deleted." });
    }
    res.status(503).json({ error: "Database not configured." });
  } catch (error: any) {
    console.error("Delete ticket error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===== TICKETS: Suggest Reply (Gemini AI) =====
app.post("/api/tickets/suggest-reply", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { issueDescription, anydeskAddress, deviceType, partner, region } = req.body;
    const ai = getGeminiClient();
    const prompt = [
      `You are a professional IT support engineer. Write a concise, friendly, and actionable reply for the following support ticket.`,
      `Issue: ${issueDescription}`,
      anydeskAddress ? `AnyDesk Address: ${anydeskAddress}` : "",
      deviceType ? `Device Type: ${deviceType}` : "",
      partner ? `Partner/School: ${partner}` : "",
      region ? `Region: ${region}` : "",
      `Provide only the reply message, no extra explanation.`,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ text: prompt }],
    });
    res.json({ suggestion: response.text || "" });
  } catch (error: any) {
    console.error("Gemini suggest-reply error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI reply." });
  }
});

// ===== TICKETS: Analyze Image (Gemini AI) =====
app.post("/api/tickets/analyze-image", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) return res.status(400).json({ error: "No image provided." });

    const parts = image.split(",");
    const rawBase64 = parts.length > 1 ? parts[1] : parts[0];
    let resolvedMimeType = mimeType || "image/jpeg";
    if (parts.length > 1) {
      const mimePart = parts[0].match(/data:(.*)/);
      if (mimePart && mimePart[1]) resolvedMimeType = mimePart[1];
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          inlineData: { data: rawBase64, mimeType: resolvedMimeType },
        },
        "You are an expert hardware and software field engineer describing an issue detected at a site for a digital school or micro-server kit. " +
          "Look at this image of a technical error, faulty hardware component, device display screens, or structural support setup. " +
          "Formulate a professional and clear 'Issue Description' for a support ticket. " +
          "The description must be concise (approx 2 to 4 sentences), detailed (specify active symptoms, apparent physical indicators, color, error texts or loose/burnt wires if any), and ready to be directly logged as the Issue Description. " +
          "Avoid boilerplate introductions or placeholders. Write only the actual technical problem statement itself.",
      ],
    });

    const description = response.text || "No descriptive output was generated.";
    res.json({ description: description.replace(/^(Issue Description:|Description:)\s*/i, "").trim() });
  } catch (error: any) {
    console.error("Gemini image analysis error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze image." });
  }
});

// ===== HARDWARE TICKETS: Get All =====
app.get("/api/hardware-tickets", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("hardware_tickets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return res.json(data || []);
    }
    res.json([]);
  } catch (error: any) {
    console.error("Get hardware tickets error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===== Export for Vercel =====
export default app;
