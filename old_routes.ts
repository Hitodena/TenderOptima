import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { emailService, sendEmail, sendSimpleEmail } from "./email";
import { ImapService } from "./imap-service";
import { personalImapService } from "./imap-service-personal";
import { AsyncEmailProcessor } from "./async-processing/email-processor";
import { nanoid } from "nanoid";
import 'express-session';

// ╨а╨░╤Б╤И╨╕╤А╤П╨╡╨╝ ╤В╨╕╨┐╤Л ╨┤╨╗╤П Session, ╤З╤В╨╛╨▒╤Л ╨┤╨╛╨▒╨░╨▓╨╕╤В╤М ╨┐╨╛╨┤╨┤╨╡╤А╨╢╨║╤Г userId
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    passport?: any;
  }
}
// ╨б╨╛╨╖╨┤╨░╨╡╨╝ ╤Н╨║╨╖╨╡╨╝╨┐╨╗╤П╤А IMAP-╤Б╨╡╤А╨▓╨╕╤Б╨░
const imapService = new ImapService();
import { generateComparisonHandler } from "./routes/compare";
import { handleFixedCompareRequest } from "./routes/compare-fixed";
import { sendFollowUp } from "./routes/follow-up";
import { downloadAttachment } from "./routes/attachments";
import { addSupplierMessage, getSupplierMessages } from "./routes/supplier-messages";
import supplierAttachmentRoutes, { downloadSupplierAttachment } from "./routes/supplier-attachments";
import { downloadSupplierMessageAttachment } from "./routes/supplier-message-attachments";
import extractParametersRoutes from "./routes/extract-parameters";
import { parameterRoutes } from "./routes/parameters";
import analysisResultsRoutes from "./routes/analysis-results";
import { generateSupplierAnalysis } from "./routes/analysis";

import analysisProjectsRoutes from './routes/analysis-projects';
import analysisIntegrationRoutes from './routes/analysis-integration';
import analysisRequestsRoutes from './routes/analysis-requests';
import supplierSearchRoutes from './routes/supplier-search';
import universalSearchRoutes from './routes/universal-search';
import { sendImprovementRequest } from "./routes/improvement-request";
import { sendWinnerNotification, getWinnerInfo, cancelWinnerSelection } from "./routes/winner-notification";
import { setupAuth, requireAdmin, tokenAuthMiddleware, getImprovementRequestCounts, saveImprovementRequest, generateToken, comparePasswords } from "./auth";
import { requireAuth } from "./middleware/requireAuth";
import semanticVectorizationRoutes from "./routes/semantic-vectorization";
import adminEmailRoutes from "./routes/admin-email";
import adminModerationRoutes from "./routes/admin-moderation";
import adminModerationTestRoutes from "./routes/admin-moderation-test";
import adminExcludedDomainsRoutes from "./routes/admin-excluded-domains";
import adminClientRequestsRoutes from "./routes/admin-client-requests";
import adminUnprocessedEmailsRoutes from "./routes/admin-unprocessed-emails";


import { matchingService } from "./matching-service";
import { subscriptionService } from "./subscription";
import subscriptionRoutes from "./routes/subscriptions";
import { 
  searchRequestFormSchema, 
  emailTemplateSchema,
  insertSupplierResponseSchema,
  insertUserSchema,
  userLoginSchema,
  insertAnalysisResultSchema,
  insertContactGroupSchema,
  insertContactItemSchema,
  insertEmailRequestSchema,
  insertRequestSupplierGroupSchema,
  contactItems,
  users
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { z } from "zod";
import { SearchRequest, InsertSearchRequest, Supplier, SupplierMatch, RequestSupplier, supplierResponses } from "@shared/schema";
import { pool } from "./db";
import { attachmentProcessor } from './services/attachment-processor';
import { registerAttachmentManagementRoutes } from './routes/attachment-management';

export async function registerRoutes(app: Express): Promise<Server> {
  // Minimal request logging for performance
  app.use((req, res, next) => {
    next();
  });

  // Test email endpoint (public, for debugging only) - bypass auth
  app.post("/api/test-personal-email", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      
      // Test email with user's personal configuration
      const success = await sendEmail(
        "test@example.com", 
        "Test Personal Email Configuration", 
        "This is a test to verify personal email settings are working.",
        { userId: parseInt(userId) }
      );
      
      res.json({ success, message: success ? "Email sent successfully" : "Email failed to send" });
    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Add health check endpoint (public)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", version: "1.0.0" });
  });

  // Add public status endpoint
  app.get("/api/status", (_req, res) => {
    res.json({ status: "running", timestamp: new Date().toISOString() });
  });

  // Authentication routes are handled in the auth.ts module
  // app.post("/api/auth/register") - managed by setupAuth
  // app.post("/api/auth/login") - managed by setupAuth
  // app.post("/api/auth/logout") - managed by setupAuth
  // app.get("/api/auth/me") - managed by setupAuth
  // app.put("/api/auth/business-card") - managed by setupAuth

  // Authentication routes are handled in auth.ts - no duplicate routes needed here


  // Get batch of supplier responses for multiple requests (GET ╨╝╨╡╤В╨╛╨┤ ╤Б ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨░╨╝╨╕ ╨▓ URL)
  app.get("/api/supplier-responses-batch", requireAuth, async (req, res) => {
    try {
      // Set cache control header to prevent caching
      res.set('Cache-Control', 'no-store');

      const requestIdsParam = req.query.requestIds as string;
      if (!requestIdsParam) {
        return res.status(400).json({ message: "requestIds parameter is required" });
      }

      let requestIds: number[] = [];
      try {
        requestIds = JSON.parse(requestIdsParam).map((id: any) => parseInt(id));
        if (!Array.isArray(requestIds) || requestIds.some(id => isNaN(id))) {
          return res.status(400).json({ message: "Invalid requestIds format. Expected JSON array of numbers." });
        }
      } catch (error) {
        return res.status(400).json({ message: "Failed to parse requestIds parameter" });
      }

      // CRITICAL SECURITY: Get authenticated user ID
      const userId = req.user?.id;
      if (!userId) {
        console.error("[Server] SECURITY: User ID not found in GET batch response request");
        return res.status(401).json({ error: "Authentication required for data access" });
      }

      console.log(`[Server] SECURITY: Fetching supplier responses for ${requestIds.length} requests for user ${userId}`);

      const batchResults: Record<string, any[]> = {};

      // CRITICAL SECURITY: Pass userId to enforce data isolation
      const allResponses = await storage.getAllSupplierResponsesForRequestsOptimized(requestIds, userId);

      // Group responses by requestId
      for (const response of allResponses) {
        const requestId = response.requestId.toString();
        if (!batchResults[requestId]) {
          batchResults[requestId] = [];
        }
        batchResults[requestId].push(response);
      }

      res.json(batchResults);
    } catch (error) {
      console.error("Error fetching batch supplier responses:", error);
      res.status(500).json({ message: "Failed to fetch supplier responses" });
    }
  });

  // Fixed comparison endpoint that consolidates suppliers by email
  app.post("/api/compare-fixed", handleFixedCompareRequest);

  // Improvement request endpoint
  app.post("/api/improvement-request", requireAuth, sendImprovementRequest);

  // Winner notification endpoints
  app.post("/api/winner-notification", requireAuth, sendWinnerNotification);
  app.get("/api/winner-info/:requestId", requireAuth, getWinnerInfo);
  app.delete("/api/winner-selection/:requestId", requireAuth, cancelWinnerSelection);

  // Get improvement request counts
  // app.get("/api/improvement-requests/counts", requireAuth, getImprovementRequestCounts); // Disabled - using storage method instead

  // POST ╨╝╨╡╤В╨╛╨┤ ╨┤╨╗╤П ╨┐╨░╨║╨╡╤В╨╜╨╛╨╣ ╨╖╨░╨│╤А╤Г╨╖╨║╨╕ ╨╛╤В╨▓╨╡╤В╨╛╨▓ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ (╨┤╨░╨╜╨╜╤Л╨╡ ╨▓ ╤В╨╡╨╗╨╡ ╨╖╨░╨┐╤А╨╛╤Б╨░)
  app.post("/api/supplier-responses-batch", requireAuth, async (req, res) => {
    try {
      // Set cache control header to prevent caching
      res.set('Cache-Control', 'no-store');

      const { requestIds } = req.body;
      if (!Array.isArray(requestIds) || requestIds.length === 0) {
        return res.status(400).json({ message: "Invalid request: requestIds must be a non-empty array" });
      }

      // ╨Я╤А╨╡╨╛╨▒╤А╨░╨╖╤Г╨╡╨╝ ╤Б╤В╤А╨╛╨║╨╛╨▓╤Л╨╡ ID ╨▓ ╤З╨╕╤Б╨╗╨╛╨▓╤Л╨╡, ╨╡╤Б╨╗╨╕ ╨╜╤Г╨╢╨╜╨╛
      const validIds = requestIds
        .map(id => typeof id === 'string' ? parseInt(id) : id)
        .filter(id => !isNaN(id));

      if (validIds.length === 0) {
        return res.status(400).json({ message: "No valid request IDs provided" });
      }

      // CRITICAL SECURITY: Get authenticated user ID
      const userId = req.user?.id;
      if (!userId) {
        console.error("[Server] SECURITY: User ID not found in POST batch response request");
        return res.status(401).json({ error: "Authentication required for data access" });
      }

      console.log(`[Server] SECURITY: POST batch loading supplier responses for ${validIds.length} requests for user ${userId}`);

      // CRITICAL SECURITY: Pass userId to enforce data isolation
      const allResponses = await storage.getAllSupplierResponsesForRequests(validIds, userId);

      // ╨У╤А╤Г╨┐╨┐╨╕╤А╤Г╨╡╨╝ ╨╛╤В╨▓╨╡╤В╤Л ╨┐╨╛ ID ╨╖╨░╨┐╤А╨╛╤Б╨░
      const responsesByRequestId: Record<string, any[]> = {};

      // ╨Ш╨╜╨╕╤Ж╨╕╨░╨╗╨╕╨╖╨╕╤А╤Г╨╡╨╝ ╨┐╤Г╤Б╤В╤Л╨╡ ╨╝╨░╤Б╤Б╨╕╨▓╤Л ╨┤╨╗╤П ╨║╨░╨╢╨┤╨╛╨│╨╛ ID ╨╖╨░╨┐╤А╨╛╤Б╨░
      validIds.forEach(id => {
        responsesByRequestId[id] = [];
      });

      // ╨а╨░╤Б╨┐╤А╨╡╨┤╨╡╨╗╤П╨╡╨╝ ╨╛╤В╨▓╨╡╤В╤Л ╨┐╨╛ ╤Б╨╛╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╤Г╤О╤Й╨╕╨╝ ╨╖╨░╨┐╤А╨╛╤Б╨░╨╝
      for (const response of allResponses) {
        const requestId = response.requestId.toString();
        if (responsesByRequestId[requestId]) {
          responsesByRequestId[requestId].push(response);
        }
      }

      console.log(`Returning responses for ${validIds.length} requests. Total responses: ${allResponses.length}`);

      res.json(responsesByRequestId);
    } catch (error) {
      console.error(`Error fetching batch supplier responses:`, error);
      res.status(500).json({ message: "Failed to fetch batch supplier responses", error: String(error) });
    }
  });

  // Get all supplier responses (fallback when no request ID is provided)
  app.get("/api/supplier-responses", requireAuth, async (req, res) => {
    try {
      // Set cache control header to prevent caching
      res.set('Cache-Control', 'no-store');

      const requestIdParam = req.query.requestId;

      if (requestIdParam) {
        // If requestId query parameter is provided
        const requestId = parseInt(requestIdParam as string);
        if (isNaN(requestId)) {
          return res.status(400).json({ message: "Invalid request ID format" });
        }

        console.log(`Fetching supplier responses for request ID: ${requestId}`);
        const responses = await storage.getSupplierResponses(requestId);
        return res.json(responses);
      } else {
        // For security and performance reasons, we don't want to return all responses
        // Instead, return an empty array since a specific request ID should always be provided
        return res.json([]);
      }
    } catch (error) {
      console.error(`Error in supplier responses:`, error);
      res.status(500).json({ message: "Failed to fetch supplier responses", error: String(error) });
    }
  });

  // Get a single supplier response by ID
  app.get("/api/supplier-responses/:id", requireAuth, async (req, res) => {
    try {
      const responseId = parseInt(req.params.id);
      if (isNaN(responseId)) {
        return res.status(400).json({ message: "Invalid response ID format" });
      }

      // Get the specific supplier response
      const response = await storage.getSupplierResponseById(responseId);

      if (!response) {
        return res.status(404).json({ message: "Supplier response not found" });
      }

      let content = response.content;

      try {
        const { rows } = await pool.query(
          `SELECT content FROM response_contents WHERE response_id = $1 LIMIT 1`,
          [responseId]
        );

        if (rows && rows.length > 0 && rows[0].content) {
          content = rows[0].content;
        }
      } catch (contentError) {
        console.error(`Error fetching HTML content for response ${responseId}:`, contentError);
      }

      return res.json({
        ...response,
        content
      });
    } catch (error) {
      console.error(`Error fetching supplier response:`, error);
      res.status(500).json({ message: "Failed to fetch supplier response", error: String(error) });
    }
  });

  // Get supplier responses for a specific request ID - MUST BE BEFORE the :id ROUTE
  app.get("/api/supplier-responses-by-request/:requestId", requireAuth, async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      if (isNaN(requestId)) {
        return res.status(400).json({ message: "Invalid request ID format" });
      }

      // Get responses and preserve read status
      const responses = await storage.getSupplierResponses(requestId);

      // Set Cache-Control header to prevent caching
      res.set('Cache-Control', 'no-store');
      res.json(responses);
    } catch (error) {
      console.error(`Error fetching responses for request ID ${req.params.requestId}:`, error);
      res.status(500).json({ message: "Failed to fetch supplier responses", error: String(error) });
    }
  });

  // Get extracted parameters for a supplier response
  app.get("/api/supplier-responses/:id/parameters", requireAuth, async (req, res) => {
    try {
      const responseId = parseInt(req.params.id);
      if (isNaN(responseId)) {
        return res.status(400).json({ message: "Invalid response ID format" });
      }

      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get the extracted parameters for this response
      const parameters = await storage.getExtractedParametersByResponseId(responseId, userId);

      if (!parameters) {
        return res.status(404).json({ message: "No extracted parameters found for this response" });
      }

      return res.json({
        responseId: responseId,
        parameters: parameters.parameters || {},
        status: parameters.status,
        extractionDate: parameters.extractionDate,
        lastUpdateDate: parameters.lastUpdateDate
      });
    } catch (error) {
      console.error(`Error fetching extracted parameters for response ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to fetch extracted parameters", error: String(error) });
    }
  });

  // Mark a supplier response as read
  app.patch("/api/supplier-responses/:id/read", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      const response = await storage.markSupplierResponseAsRead(id);
      if (!response) {
        return res.status(404).json({ message: `Response with ID ${id} not found` });
      }

      res.json({
        success: true,
        response
      });
    } catch (error) {
      console.error(`Error marking response ${req.params.id} as read:`, error);
      res.status(500).json({ message: "Failed to mark response as read", error: String(error) });
    }
  });

  // Toggle a supplier response as favorite
  app.patch("/api/supplier-responses/:id/toggle-favorite", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "╨Э╨╡╨▓╨╡╤А╨╜╤Л╨╣ ╤Д╨╛╤А╨╝╨░╤В ID" });
      }

      const response = await storage.toggleFavoriteResponse(id);
      if (!response) {
        return res.status(404).json({ message: `╨Ю╤В╨▓╨╡╤В ╤Б ID ${id} ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜` });
      }

      res.json({
        success: true,
        isFavorite: response.isFavorite,
        message: response.isFavorite ? "╨Ф╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╛ ╨▓ ╨╕╨╖╨▒╤А╨░╨╜╨╜╨╛╨╡" : "╨г╨┤╨░╨╗╨╡╨╜╨╛ ╨╕╨╖ ╨╕╨╖╨▒╤А╨░╨╜╨╜╨╛╨│╨╛",
        response
      });
    } catch (error) {
      console.error(`╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨╕╨╖╨╝╨╡╨╜╨╡╨╜╨╕╨╕ ╤Б╤В╨░╤В╤Г╤Б╨░ ╨╕╨╖╨▒╤А╨░╨╜╨╜╨╛╨│╨╛ ╨┤╨╗╤П ╨╛╤В╨▓╨╡╤В╨░ ${req.params.id}:`, error);
      res.status(500).json({ 
        message: "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨╕╨╖╨╝╨╡╨╜╨╕╤В╤М ╤Б╤В╨░╤В╤Г╤Б ╨╕╨╖╨▒╤А╨░╨╜╨╜╨╛╨│╨╛", 
        error: String(error) 
      });
    }
  });

  // Get supplier responses by specific response IDs for comparison
  app.get("/api/supplier-responses", requireAuth, async (req, res) => {
    try {
      const { requestId, responseIds } = req.query;

      if (!requestId || !responseIds) {
        return res.status(400).json({ message: "Request ID and response IDs are required" });
      }

      const userId = req.user?.id;
      const requestIdNum = parseInt(requestId as string);
      const responseIdsList = (responseIds as string).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

      if (isNaN(requestIdNum) || responseIdsList.length === 0) {
        return res.status(400).json({ message: "Invalid request ID or response IDs format" });
      }

      console.log(`Fetching supplier responses for request ${requestIdNum}, response IDs: ${responseIdsList.join(',')}`);

      // Get all responses for the request first
      const allResponses = await storage.getSupplierResponses(requestIdNum, userId);

      // Filter to only the requested response IDs
      const filteredResponses = allResponses.filter(response => 
        responseIdsList.includes(response.id)
      );

      console.log(`Found ${filteredResponses.length} responses matching the requested IDs`);

      res.json(filteredResponses);
    } catch (error) {
      console.error("Error fetching supplier responses by IDs:", error);
      res.status(500).json({ message: "Failed to fetch supplier responses", error: String(error) });
    }
  });

  // Get all suppliers
  app.get("/api/suppliers", requireAuth, async (_req, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers", error: String(error) });
    }
  });

  // Get groups for a supplier
  app.get("/api/supplier-groups/:supplierId", requireAuth, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.supplierId);
      if (isNaN(supplierId)) {
        return res.status(400).json({ message: "Invalid supplier ID" });
      }

      const groupIds = await storage.getSupplierGroups(supplierId);
      res.json(groupIds);
    } catch (error) {
      console.error(`Error fetching groups for supplier ${req.params.supplierId}:`, error);
      res.status(500).json({ message: "Failed to fetch supplier groups", error: String(error) });
    }
  });

  // Update groups for a supplier
  app.post("/api/suppliers/:supplierId/groups", requireAuth, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.supplierId);
      if (isNaN(supplierId)) {
        return res.status(400).json({ message: "Invalid supplier ID" });
      }

      const { groupIds } = req.body;
      if (!Array.isArray(groupIds)) {
        return res.status(400).json({ message: "groupIds must be an array of numbers" });
      }

      const result = await storage.updateSupplierGroups(supplierId, groupIds);

      if (result.success) {
        res.json({ success: true, message: "Supplier groups updated successfully" });
      } else {
        res.status(400).json({ success: false, message: "Failed to update supplier groups" });
      }
    } catch (error) {
      console.error(`Error updating groups for supplier ${req.params.supplierId}:`, error);
      res.status(500).json({ message: "Failed to update supplier groups", error: String(error) });
    }
  });

  // Get a specific supplier
  app.get("/api/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid supplier ID format" });
      }

      const supplier = await storage.getSupplier(id);
      if (!supplier) {
        return res.status(404).json({ message: `Supplier with ID ${id} not found` });
      }

      res.json(supplier);
    } catch (error) {
      console.error(`Error fetching supplier ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to fetch supplier", error: String(error) });
    }
  });

  // Supplier lookup by string ID (for API suppliers)
  app.get("/api/suppliers/lookup/:stringId", requireAuth, async (req, res) => {
    try {
      const stringId = req.params.stringId;

      // For API suppliers, the ID is a string starting with 'api-'
      if (!stringId.startsWith('api-')) {
        return res.status(400).json({ message: "Invalid API supplier ID format" });
      }

      const supplier = await storage.getSupplierByStringId(stringId);
      if (!supplier) {
        return res.status(404).json({ message: `Supplier with ID ${stringId} not found` });
      }

      res.json(supplier);
    } catch (error) {
      console.error(`Error fetching supplier by string ID ${req.params.stringId}:`, error);
      res.status(500).json({ message: "Failed to fetch supplier", error: String(error) });
    }
  });

  // Endpoint to perform supplier search and processing
  app.post("/api/search-requests", requireAuth, async (req, res) => {
    try {
      const request = searchRequestFormSchema.parse(req.body);

      // Generate unique order number
      const orderNumber = storage.generateOrderNumber();

      // Get user ID from the authenticated session or use default test user in dev mode
      let userId = req.user?.id;

      // In development mode, if we don't have a userId, use the test user ID=1
      if (!userId && process.env.SKIP_AUTH === 'true') {
        console.log('[Server] Using test user ID=1 for search request in SKIP_AUTH mode');
        userId = 1;
      } else if (!userId) {
        // ╨Х╤Б╨╗╨╕ userId ╨╜╨╡ ╤Г╤Б╤В╨░╨╜╨╛╨▓╨╗╨╡╨╜ ╨╕ ╨╜╨╡ ╨▓ ╤А╨╡╨╢╨╕╨╝╨╡ SKIP_AUTH, ╨╖╨╜╨░╤З╨╕╤В ╤Г ╨╜╨░╤Б ╨┐╤А╨╛╨▒╨╗╨╡╨╝╨░ ╤Б ╤Б╨╡╤Б╤Б╨╕╨╡╨╣
        console.log('[Server] WARNING: userId not set for authenticated request!', req.user);
        // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤О ╨╛ ╤Б╨╡╤Б╤Б╨╕╨╕ ╨┤╨╗╤П ╨╛╤В╨╗╨░╨┤╨║╨╕
        console.log('[Server] Session info:', req.session);
        return res.status(401).json({ error: '╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨┐╨╛╨╗╤Г╤З╨╕╤В╤М ID ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨╕╨╖ ╤Б╨╡╤Б╤Б╨╕╨╕. ╨Я╨╛╨╢╨░╨╗╤Г╨╣╤Б╤В╨░, ╨┐╨╛╨┐╤А╨╛╨▒╤Г╨╣╤В╨╡ ╨▓╨╛╨╣╤В╨╕ ╨╖╨░╨╜╨╛╨▓╨╛.' });
      }

      // Check subscription status (but don't increment counter for search requests)
      if (userId && process.env.SKIP_AUTH !== 'true') {
        const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(userId);
        if (!subscriptionStatus.isActive) {
          console.log(`[search-requests] User ${userId} subscription is not active: ${subscriptionStatus.message}`);
          return res.status(403).json({ 
            error: '╨Я╨╛╨┤╨┐╨╕╤Б╨║╨░ ╨╜╨╡╨░╨║╤В╨╕╨▓╨╜╨░', 
            message: subscriptionStatus.message 
          });
        }

        console.log(`[search-requests] Subscription active for user ${userId} - creating search request (no counter increment)`);
      }

      // Create new search request with custom properties
      const newRequest: InsertSearchRequest = {
        productName: request.productName,
        productDescription: request.productDescription || "",
        timeline: request.timeline,
        orderNumber,
        status: 'pending',
        useDbSearch: request.useDbSearch || false,
        useApiSearch: request.useApiSearch || false,
        matchedSuppliers: [],
        userId: userId
      };

      let matchedSuppliers: SupplierMatch[] = [];
      let apiSuppliers: Supplier[] = [];  // Store API suppliers separately

      // Get all suppliers (shared database for all users)
      const allSuppliers = await storage.getSuppliers(); // Remove userId to get all suppliers

      // Perform local database search if requested
      if (request.useDbSearch) {
        matchedSuppliers = await matchingService.matchSuppliers(allSuppliers, request as SearchRequest);
        console.log(`Database search found ${matchedSuppliers?.length || 0} matching suppliers from shared database`);

        // Check user subscription to apply limits
        const subscription = await subscriptionService.getSubscription(userId);
        const isTrialUser = subscription?.plan === 'trial';
        const maxResults = isTrialUser ? 10 : 50; // Trial users get max 10, others get more

        // Get the top N suppliers for the request based on user plan
        const topSuppliers = matchedSuppliers
          .sort((a, b) => b.matchScore - a.matchScore) // Sort descending by matchScore
          .slice(0, maxResults); // Apply plan-based limit

        // Extract just the IDs for the matchedSuppliers array (which is defined as integer[])
        const matchedSupplierIds = topSuppliers
          .filter(match => typeof match.id !== 'undefined')
          .map(match => {
            // Handle both number and string IDs by converting to number
            return typeof match.id === 'string' 
              ? parseInt(match.id, 10) 
              : match.id;
          })
          .filter(id => !isNaN(id)); // Filter out any NaN values

        console.log('Matched supplier IDs:', matchedSupplierIds);
        newRequest.matchedSuppliers = matchedSupplierIds;
      }

      // Save the search request to the database
      const searchRequest = await storage.createSearchRequest(newRequest);
      console.log(`[ROOT_CAUSE_DEBUG] Created search request with ID: ${searchRequest.id}`);

      // Save selected parameters if provided
      if (request.parameters && request.parameters.length > 0) {
        console.log(`[ROOT_CAUSE_DEBUG] About to save parameters for request ID: ${searchRequest.id}`);
        try {
          await storage.saveParametersForRequest(searchRequest.id, request.parameters, userId);
        } catch (error) {
          console.error(`Error saving parameters for request ${searchRequest.id}:`, error);
          // Don't fail the request creation if parameter saving fails
        }
      }

      // Return the search request with matched suppliers and proper ID information
      console.log("Created search request:", searchRequest);

      // Prepare subscription info for response
      let subscriptionInfo = {};
      if (request.useDbSearch && matchedSuppliers.length > 0) {
        const subscription = await subscriptionService.getSubscription(userId);
        const isTrialUser = subscription?.plan === 'trial';
        const totalFound = matchedSuppliers.length;
        const maxResults = isTrialUser ? 10 : 50;
        const showingCount = Math.min(totalFound, maxResults);
        
        subscriptionInfo = {
          totalFound,
          showingCount,
          isTrialUser,
          limitMessage: isTrialUser && totalFound > 10 
            ? `╨Э╨░╨╣╨┤╨╡╨╜╨╛ ╨▓╤Б╨╡╨│╨╛ ${totalFound}, ╨▓ ╨┐╤А╨╛╨▒╨╜╨╛╨╣ ╨▓╨╡╤А╤Б╨╕╨╕ ╨┤╨╛╤Б╤В╤Г╨┐╨╜╤Л ╨╝╨░╨║╤Б╨╕╨╝╤Г╨╝ ╨┐╨╡╤А╨▓╤Л╨╡ 10 ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓`
            : null
        };
      }

      // Make sure to include the order number in the response for client-side request ID extraction
      res.status(201).json({ 
        request: {
          ...request,
          id: searchRequest.id,  // Include the actual ID from DB
          orderNumber: orderNumber, // Include order number
          // Add createdAt from the database record
          createdAt: searchRequest.createdAt instanceof Date 
            ? searchRequest.createdAt.toISOString() 
            : searchRequest.createdAt
        }, 
        orderNumber: orderNumber, // Also include at top level
        id: searchRequest.id, // Also include at top level
        matchedSuppliers,
        ...subscriptionInfo // Include subscription and limit info
      });
    } catch (error) {
      console.error("Error processing search request:", error);
      return res.status(400).json({ message: "Invalid request data", error: String(error) });
    }
  });

  // Send email to suppliers
  app.post("/api/send-email", requireAuth, async (req, res) => {
    try {
      // Get authenticated user ID
      const userId = req.user?.id;
      if (!userId) {
        console.error("[Server] User ID not found in send-email request");
        return res.status(401).json({ error: "User authentication required" });
      }
      
      console.log(`[email] Processing send-email request for user ${userId}`);

      // Check subscription status and increment request count for email sending
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(userId);
      if (!subscriptionStatus.isActive) {
        console.log(`[send-email] User ${userId} subscription is not active: ${subscriptionStatus.message}`);
        return res.status(403).json({ 
          error: '╨Я╨╛╨┤╨┐╨╕╤Б╨║╨░ ╨╜╨╡╨░╨║╤В╨╕╨▓╨╜╨░', 
          message: subscriptionStatus.message 
        });
      }

      // Increment the request count
      const countIncremented = await subscriptionService.incrementRequestCount(userId);
      if (!countIncremented) {
        console.error(`[send-email] Failed to increment request count for user ${userId}`);
        return res.status(500).json({ 
          error: '╨Ю╤И╨╕╨▒╨║╨░ ╤Г╤З╨╡╤В╨░ ╨╕╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╨╜╨╕╤П' 
        });
      }

      console.log(`[send-email] Request count incremented for user ${userId}`);
      
      // Extract and validate basic fields
      const { suppliers: supplierIds, subject, message, requestId, attachments } = emailTemplateSchema.parse(req.body);

      // Handle search request - either get existing or create a temporary one for direct emails
      let searchRequest: SearchRequest;

      if (requestId === 0) {
        // This is a direct email without an associated search request
        // Create a search request in the database to ensure it's tracked
        const orderNumber = storage.generateOrderNumber();

        const tempRequest = {
          productName: subject || '╨Я╤А╤П╨╝╨╛╨╣ ╨╖╨░╨┐╤А╨╛╤Б',
          productDescription: '╨б╨╛╨╖╨┤╨░╨╜╨╛ ╤З╨╡╤А╨╡╨╖ ╤Д╨╛╤А╨╝╤Г ╨┐╤А╤П╨╝╨╛╨│╨╛ ╨╖╨░╨┐╤А╨╛╤Б╨░',
          createdAt: new Date(),
          orderNumber: orderNumber,
          status: 'draft',
          timeline: new Date().toISOString(),  // Set to current date
          additionalRequirements: null,
          matchedSuppliers: [],
          useDbSearch: false,
          useApiSearch: false,
          userId: userId
        };

        // Save the temporary request to the database
        searchRequest = await storage.createSearchRequest(tempRequest);
        console.log(`Created and saved search request with order number: ${searchRequest.orderNumber} for direct email. ID: ${searchRequest.id}`);

        // Save user-selected parameters from the request body
        try {
          const userSelectedParams = req.body.parameters;
          if (userSelectedParams && Array.isArray(userSelectedParams) && userSelectedParams.length > 0) {
            // Convert parameter objects to strings if needed
            const paramStrings = userSelectedParams.map(param => {
              if (typeof param === 'string') return param;
              if (param && typeof param === 'object' && param.label) return param.label;
              return String(param);
            });

            console.log(`[ROOT_CAUSE_FIX] Saving ${paramStrings.length} user-selected parameters for email-based request ${searchRequest.id}:`, paramStrings);
            await storage.saveParametersForRequest(searchRequest.id, paramStrings, userId);
            console.log(`[ROOT_CAUSE_FIX] Successfully saved user-selected parameters for email-based request ${searchRequest.id}`);
          } else {
            // Fallback to default parameters only if no user parameters provided
            const fallbackParams = ['╨Ю╨▒╤Й╨░╤П ╤Б╤В╨╛╨╕╨╝╨╛╤Б╤В╤М ╨▒╨╡╨╖ ╨Э╨Ф╨б', '╨б╤А╨╛╨║╨╕ ╨┐╨╛╤Б╤В╨░╨▓╨║╨╕'];
            console.log(`[ROOT_CAUSE_FIX] No user parameters provided, using fallback parameters for email-based request ${searchRequest.id}`);
            await storage.saveParametersForRequest(searchRequest.id, fallbackParams, userId);
          }
        } catch (paramError) {
          console.error(`Error saving parameters for email-based request ${searchRequest.id}:`, paramError);
          // Don't fail the email sending if parameter saving fails
        }
      } else {
        // Regular case - get the search request from storage
        const existingRequest = await storage.getSearchRequest(requestId);
        if (!existingRequest) {
          return res.status(404).json({ message: `Search request with ID ${requestId} not found` });
        }
        searchRequest = existingRequest;
      }

      // Get all suppliers from database
      const databaseSuppliers = await storage.getSuppliers();
      
      // ╨Я╤А╨╛╨▓╨╡╤А╨╕╨╝, ╨┐╤А╨╕╤И╨╗╨╕ ╨╗╨╕ ID ╨╕╨╖ ╨│╤А╤Г╨┐╨┐ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ (╨╜╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓)
      const isFromContactGroup = req.body.fromContactGroup === true;
      
      // Handle both database suppliers (positive IDs) and API suppliers (negative IDs)
      let selectedSuppliers = [];

      if (isFromContactGroup) {
        // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ╨║╨╛╨╜╤В╨░╨║╤В╤Л ╨╕╨╖ ╨│╤А╤Г╨┐╨┐ ╨┐╨╛ ID
        const contactIds = supplierIds.filter(id => typeof id === 'number' || (typeof id === 'string' && !id.startsWith('api-')));
        console.log("Contact group IDs:", contactIds);
        
        // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ╨┤╨╡╤В╨░╨╗╨╕ ╨┤╨╗╤П ╨▓╤Б╨╡╤Е ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓
        let groupContacts = [];
        for (const contactId of contactIds) {
          try {
            const contact = await storage.getContactById(parseInt(String(contactId)));
            if (contact) {
              console.log(`Found contact: ${contact.name} (ID: ${contact.id}, Email: ${contact.email})`);
              groupContacts.push({
                id: contact.id,
                name: contact.name || `Unknown (${contact.email})`,
                email: contact.email,
                phone: contact.phone || "",
                website: contact.organization || ""
              });
            }
          } catch (error) {
            console.error(`Error getting contact with ID ${contactId}:`, error);
          }
        }
        
        console.log(`Found ${groupContacts.length} contacts from contact groups`);
        selectedSuppliers.push(...groupContacts);
      } else {
        // ╨б╤В╨░╨╜╨┤╨░╤А╤В╨╜╨░╤П ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╨░ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓
        console.log("Database supplier IDs:", supplierIds.filter(id => typeof id === 'number' || (typeof id === 'string' && !id.startsWith('api-'))));
        
        const dbSelectedSuppliers = databaseSuppliers.filter(s => {
          // Convert both to strings for comparison
          const sIdString = String(s.id);
          const included = supplierIds.some(id => String(id) === sIdString);
          console.log(`Checking DB supplier ${s.name} (ID: ${s.id}): Selected = ${included}`);
          return included;
        });
      
      console.log(`Selected ${dbSelectedSuppliers.length} database suppliers from ${databaseSuppliers.length} available`);
      selectedSuppliers.push(...dbSelectedSuppliers);

      // Process API suppliers if they exist - these will be included directly in the request
      if (req.body.apiSuppliers && Array.isArray(req.body.apiSuppliers)) {
        // Already have full supplier objects from the frontend
        const apiSuppliers = req.body.apiSuppliers;
        
        // Check if suppliers with api- prefix are in the supplierIds array
        const apiPrefixIds = supplierIds.filter(id => typeof id === 'string' && id.startsWith('api-'));
        
        console.log(`API supplier IDs selected (${apiPrefixIds.length}):`, apiPrefixIds);
        
        // Only include API suppliers that were actually selected (with api- prefix in supplierIds)
        const selectedApiSuppliers = apiSuppliers.filter((supplier: Supplier) => {
          // Convert negative ID to positive for string comparison
          const supplierIdStr = String(supplier.id);
          const apiId = `api-${Math.abs(typeof supplier.id === 'number' ? supplier.id : parseInt(supplierIdStr))}`;
          
          // Check both the formatted api-ID and the raw supplier ID string
          const includedByApiId = apiPrefixIds.includes(apiId);
          const includedByRawId = supplierIds.some(id => String(id) === supplierIdStr);
          const included = includedByApiId || includedByRawId;
          
          console.log(`Checking API supplier ${supplier.name} (ID: ${supplier.id}): API ID = ${apiId}, Selected = ${included}`);
          return included;
        });
        
        // Double-check if we found all the suppliers that should be included
        if (selectedApiSuppliers.length !== apiPrefixIds.length) {
          console.warn(`Warning: Found ${selectedApiSuppliers.length} API suppliers, but ${apiPrefixIds.length} were selected. This might indicate a mismatch.`);
          
          // Log the IDs that couldn't be matched
          const foundIds = selectedApiSuppliers.map((s: Supplier) => {
            return `api-${Math.abs(typeof s.id === 'number' ? s.id : parseInt(s.id as string))}`;
          });
          
          const missingIds = apiPrefixIds.filter(id => !foundIds.includes(id));
          if (missingIds.length > 0) {
            console.warn(`Missing supplier IDs: ${missingIds.join(', ')}`);
          }
        }
        
        console.log(`Selected ${selectedApiSuppliers.length} API suppliers from ${apiSuppliers.length} available`);
        selectedSuppliers.push(...selectedApiSuppliers);
      }
      }

      // selectedSuppliers already contains all suppliers from the logic above

      // Remove duplicates based on email address
      const uniqueSuppliers = [];
      const seenEmails = new Set();
      for (const supplier of selectedSuppliers) {
        if (!seenEmails.has(supplier.email)) {
          seenEmails.add(supplier.email);
          uniqueSuppliers.push(supplier);
        } else {
          console.log(`Removing duplicate supplier: ${supplier.name} (${supplier.email})`);
        }
      }
      selectedSuppliers = uniqueSuppliers;

      console.log(`Selected ${selectedSuppliers.length} suppliers in total`);

      if (selectedSuppliers.length === 0) {
        console.error("No valid suppliers found. Available supplier IDs:", supplierIds);
        return res.status(400).json({ 
          message: "No valid suppliers found to send emails to",
          debug: {
            requestedIds: supplierIds,
            totalSuppliersFound: selectedSuppliers.length
          }
        });
      }

      // Process attachments
      let sanitizedAttachments: {
        filename: string;
        contentType: string;
        content: string;
        size?: number;
      }[] = [];

      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        console.log(`Request includes ${attachments.length} attachments`);

        // Process each attachment to ensure it has valid content
        sanitizedAttachments = attachments.filter(attachment => {
          if (!attachment.filename || !attachment.contentType || !attachment.content) {
            console.warn(`Skipping invalid attachment: missing required fields`);
            return false;
          }

          // Check if content is a valid base64 string
          try {
            // Verify it's a base64 string by attempting to decode a small sample
            Buffer.from(attachment.content.substring(0, 10), 'base64');

            // ╨Я╤А╨╡╨╛╨▒╤А╨░╨╖╤Г╨╡╨╝ ╤Б╨╛╨┤╨╡╤А╨╢╨╕╨╝╨╛╨╡ ╨▓ ╤Д╨╛╤А╨╝╨░╤В, ╨┐╨╛╨┤╤Е╨╛╨┤╤П╤Й╨╕╨╣ ╨┤╨╗╤П nodemailer
            // ╨Ю╤Б╤В╨░╨▓╨╗╤П╨╡╨╝ base64 ╤Б╤В╤А╨╛╨║╤Г ╨║╨░╨║ ╨╡╤Б╤В╤М, ╨╜╨╡ ╨┐╤А╨╡╨╛╨▒╤А╨░╨╖╤Г╨╡╨╝ ╨▓ Buffer,
            // ╨╜╨╛ ╨┤╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ ╨╕╨╜╨┤╨╕╨║╨░╤В╨╛╤А encoding: 'base64' ╨▓ ╨╛╨▒╤К╨╡╨║╤В ╨▓╨╗╨╛╨╢╨╡╨╜╨╕╤П
            attachment.encoding = 'base64';

            return true;
          } catch (err) {
            console.warn(`Skipping attachment with invalid base64 content: ${attachment.filename}`);
            return false;
          }
        });

        console.log(`Processed ${sanitizedAttachments.length} valid attachments out of ${attachments.length}`);
      }

      // Debug log to check the suppliers before sending
      console.log("All selected suppliers:");
      selectedSuppliers.forEach(supplier => {
        console.log(`- ${supplier.name} (${supplier.email})`);
      });

      // Create tracking records and send emails
      const emailResults = await Promise.all(
        selectedSuppliers.map(async (supplier) => {
          try {
            // Generate unique tracking ID for this supplier-request combo
            const trackingId = storage.generateTrackingId();

            console.log(`Processing supplier: ${supplier.name} (${supplier.email}) with tracking ID: ${trackingId}`);

            // Use the authenticated user ID from above (already obtained and verified)

            // CRITICAL FIX: Ensure supplier ID is always positive
            let fixedSupplierId: string;
            if (typeof supplier.id === 'number') {
              // For numeric IDs, always use absolute value to prevent negative IDs
              fixedSupplierId = Math.abs(supplier.id).toString();
            } else if (typeof supplier.id === 'string') {
              // For string IDs, extract numeric part and ensure positive
              const numericPart = supplier.id.replace(/\D/g, '');
              fixedSupplierId = numericPart || Math.abs(Date.now() % 10000).toString();
            } else {
              // Fallback: generate a positive ID
              fixedSupplierId = Math.abs(Date.now() % 10000).toString();
            }

            console.log(`ЁЯФз Fixed supplier ID: ${supplier.id} тЖТ ${fixedSupplierId}`);

            // Create a record of this supplier request with userId
            const requestSupplier = await storage.createRequestSupplier({
              userId: userId, // Add the user ID for proper data isolation
              requestId: searchRequest.id,
              supplierId: fixedSupplierId, // Use the fixed positive supplier ID
              supplierEmail: supplier.email,
              supplierName: supplier.name || 'Unknown Supplier',
              supplierWebsite: supplier.website || '',
              supplierPhone: supplier.phone || '',
              trackingId: trackingId,
              emailSubject: subject,
              emailContent: message,
            });

            console.log(`Created requestSupplier record with ID: ${requestSupplier.id}`);

            // Format the subject with request and tracking IDs
            // REQ must be the same for ALL emails in the same request (use orderNumber from DB)
            // TID is unique for each individual email
            const requestRef = searchRequest.orderNumber;
            const formattedSubject = `${subject} - [${requestRef}] [TID:${trackingId}]`;

            // Add tracking footer to message content BEFORE business card
            // The footer should appear after the main content but before the business card
            const referenceFooter = `\n**!╨Я╤А╨╕ ╨╛╤В╨▓╨╡╤В╨╡ ╨╜╨░ ╨╜╨░╤И ╨╖╨░╨┐╤А╨╛╤Б ╨╜╨╡ ╨╝╨╡╨╜╤П╨╣╤В╨╡ ╤В╨╡╨╝╤Г ╨┐╨╕╤Б╤М╨╝╨░ (Subject), ╨╕╨╜╨░╤З╨╡ ╨╝╤Л ╨╜╨╡ ╤Б╨╝╨╛╨╢╨╡╨╝ ╨╛╨▒╤А╨░╨▒╨╛╤В╨░╤В╤М ╨▓╨░╤И ╨╛╤В╨▓╨╡╤В!**\n`;
            
            // Insert the footer before the business card if it exists in content
            let fullMessage = message;
            if (message.includes('╨б ╤Г╨▓╨░╨╢╨╡╨╜╨╕╨╡╨╝,') || message.includes('╨б ╨г╨▓╨░╨╢╨╡╨╜╨╕╨╡╨╝,')) {
              // Find the position where business card starts and insert footer before it
              const businessCardStart = message.lastIndexOf('╨б ╤Г╨▓╨░╨╢╨╡╨╜╨╕╨╡╨╝,');
              if (businessCardStart !== -1) {
                const beforeBusinessCard = message.substring(0, businessCardStart);
                const businessCard = message.substring(businessCardStart);
                // Add one space before business card
                fullMessage = beforeBusinessCard + referenceFooter + '\n' + businessCard;
              } else {
                fullMessage = message + referenceFooter;
              }
            } else {
              fullMessage = message + referenceFooter;
            }

            // ╨б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╡ ╨┐╨╡╤А╨▓╨╛╨│╨╛ ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╤П ╨▓ ╨╕╤Б╤В╨╛╤А╨╕╨╕ ╤Б userId
            try {
              await storage.addSupplierMessage({
                userId: userId, // Add user ID for proper data isolation
                requestSupplierId: requestSupplier.id,
                content: fullMessage,
                subject: formattedSubject,
                direction: 'outbound',
                sentDate: new Date(),
                attachments: sanitizedAttachments
              });
              console.log(`╨б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╛ ╨┐╨╡╤А╨▓╨╛╨╡ ╨╕╤Б╤Е╨╛╨┤╤П╤Й╨╡╨╡ ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╡ ╨┤╨╗╤П requestSupplierId=${requestSupplier.id} ╨▓ ╨╕╤Б╤В╨╛╤А╨╕╨╕ ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╣`);
            } catch (msgError) {
              console.error(`╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╨╕ ╨╕╤Б╤Е╨╛╨┤╤П╤Й╨╡╨│╨╛ ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╤П ╨▓ ╨╕╤Б╤В╨╛╤А╨╕╨╕: ${msgError}`);
            }

            // Send the email with tracking information, sanitized attachments and business card
            console.log(`[routes] *** CALLING sendSimpleEmail for ${supplier.email} ***`, { userId, trackingId });
            const emailSuccess = await sendSimpleEmail(
              supplier.email, 
              formattedSubject, 
              fullMessage,
              {
                html: fullMessage.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                attachments: sanitizedAttachments,
                trackingId: trackingId,
                requestId: searchRequest.id, // ╨Ш╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╨╝ ID ╨╖╨░╨┐╤А╨╛╤Б╨░ ╨║╨░╨║ ╨┤╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╤Л╨╣ ╨╕╨┤╨╡╨╜╤В╨╕╤Д╨╕╨║╨░╤В╨╛╤А
                userId: userId // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ ID ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨┤╨╗╤П ╨▓╨║╨╗╤О╤З╨╡╨╜╨╕╤П ╨▒╨╕╨╖╨╜╨╡╤Б-╨║╨░╤А╤В╨╛╤З╨║╨╕
              }
            );
            console.log(`[routes] *** sendEmail RETURNED ***`, { emailSuccess });

            console.log(`Email to ${supplier.email} ${emailSuccess ? 'succeeded' : 'failed'}`);

            return {
              supplier,
              trackingId,
              success: emailSuccess,
            };
          } catch (error) {
            console.error(`Error sending email to ${supplier.email}:`, error);
            return {
              supplier,
              success: false,
              error: String(error)
            };
          }
        })
      );

      // Calculate success stats
      const successCount = emailResults.filter(r => r.success).length;

      if (successCount > 0) {
        // Update request status to "sent" if at least one email was sent successfully
        await storage.updateSearchRequestStatus(searchRequest.id, "sent");
        console.log(`Updated request ${searchRequest.id} status to "sent"`);
      }

      // Log the order number being returned to ensure it's consistent
      console.log(`Email sent successfully. Returning order number: ${searchRequest.orderNumber}`);

      // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ ╨┐╨╛╨┤╤А╨╛╨▒╨╜╤Л╨╣ ╨╗╨╛╨│ ╨╛╨▒ ╤Г╤Б╨┐╨╡╤И╨╜╨╛╤Б╤В╨╕
      console.log(`Email execution summary: ${successCount} of ${selectedSuppliers.length} emails sent successfully.`);

      // Note: Request count is incremented at the beginning of this endpoint, 
      // not here at the end, to ensure consistency regardless of email success/failure

      // ╨д╨╛╤А╨╝╨╕╤А╤Г╨╡╨╝ ╨┤╨╡╤В╨░╨╗╤М╨╜╤Л╨╣ ╨╛╤В╨▓╨╡╤В ╤Б╨╛ ╨▓╤Б╨╡╨╣ ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╨╡╨╣, ╨╜╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╨╛╨╣ ╨║╨╗╨╕╨╡╨╜╤В╤Г
      res.json({ 
        success: successCount > 0, 
        totalCount: selectedSuppliers.length,
        successCount,
        orderNumber: searchRequest.orderNumber,
        requestId: searchRequest.id,
        // ╨Ф╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╨╛ ╤Д╨╕╨╗╤М╤В╤А╤Г╨╡╨╝ results, ╤З╤В╨╛╨▒╤Л ╨╜╨╡ ╨┐╨╡╤А╨╡╨┤╨░╨▓╨░╤В╤М ╤Б╨╗╨╕╤И╨║╨╛╨╝ ╨╝╨╜╨╛╨│╨╛ ╨┤╨░╨╜╨╜╤Л╤Е
        results: emailResults.map(result => ({
          supplierEmail: result.supplier.email,
          supplierName: result.supplier.name,
          success: result.success,
          trackingId: result.trackingId,
          error: result.error
        }))
      });
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(400).json({ message: "Failed to send emails", error: String(error) });
    }
  });

  // Get all search requests (filtered by user if authenticated)
  app.get("/api/search-requests", requireAuth, async (req, res) => {
    try {
      // Get the authenticated user ID from req.user - CRITICAL FOR DATA ISOLATION
      const userId = req.user?.id;

      if (!userId) {
        console.error("[Server] SECURITY: User ID not found in authenticated request");
        return res.status(401).json({ error: "Authentication required for data access" });
      }

      console.log(`[Server] SECURITY: Fetching search requests ONLY for user ID: ${userId}`);
      // FORCE user filtering - never return data without userId
      const requests = await storage.getAllSearchRequests(userId);

      console.log(`[Server] SECURITY: Returning ${requests.length} requests exclusively for user ID: ${userId}`);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching search requests:", error);
      res.status(500).json({ message: "Failed to fetch search requests", error: String(error) });
    }
  });

  // Get search request by order number - must be BEFORE the :id route
  app.get("/api/search-requests/order/:orderNumber", requireAuth, async (req, res) => {
    try {
      const orderNumber = req.params.orderNumber;
      if (!orderNumber) {
        return res.status(400).json({ message: "Order number is required" });
      }

      const request = await storage.getSearchRequestByOrderNumber(orderNumber);
      if (!request) {
        return res.status(404).json({ message: `Request with order number ${orderNumber} not found` });
      }

      // Get all suppliers contacted for this request
      const requestSuppliers = await storage.getRequestSuppliers(request.id);

      // Get all responses for this request
      const supplierResponses = await storage.getSupplierResponses(request.id);

      res.json({
        request,
        requestSuppliers,
        supplierResponses
      });
    } catch (error) {
      console.error(`Error fetching request with order number ${req.params.orderNumber}:`, error);
      res.status(500).json({ message: "Failed to fetch request details", error: String(error) });
    }
  });

  // Get suppliers for a specific search request - must be BEFORE the :id route
  app.get("/api/search-requests/:id/suppliers", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid request ID format" });
      }

      console.log(`Fetching suppliers for search request ID: ${id}`);

      // Get user ID for data isolation
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Get the search request with user filtering
      const request = await storage.getSearchRequest(id, userId);
      if (!request) {
        return res.status(404).json({ message: `Search request with ID ${id} not found or access denied` });
      }

      // Get all suppliers from the database to match against
      const allSuppliers = await storage.getSuppliers();

      // Get matched supplier IDs from the request 
      const matchedSupplierIds = request.matchedSuppliers || [];

      // Filter suppliers by matched IDs from the request
      const matchedSuppliers = allSuppliers.filter(supplier => 
        matchedSupplierIds.includes(supplier.id)
      );

      console.log(`Found ${matchedSuppliers.length} matched suppliers for request ID ${id}`);

      // Return the matched suppliers along with the request
      res.json({
        request,
        matchedSuppliers
      });
    } catch (error) {
      console.error(`Error fetching suppliers for search request ID ${req.params.id}:`, error);
      res.status(500).json({ 
        message: "Failed to fetch suppliers for search request", 
        error: String(error) 
      });
    }
  });

  // Get details of a specific search request
  app.get("/api/search-requests/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      // Get the user ID from the authenticated user
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log(`[Server] Fetching search request ID ${id} for user ID ${userId}`);
      const endpointStartTime = Date.now();

      // Get the search request and ensure it belongs to the user
      const request = await storage.getSearchRequest(id, userId);

      // If request not found (or doesn't belong to user), return 404
      if (!request) {
        return res.status(404).json({ message: `Search request with ID ${id} not found or access denied` });
      }

      // ╨Ы╨╛╨│╨╕╤А╤Г╨╡╨╝ ╨▓╤А╨╡╨╝╤П ╤Б╨╡╤А╨╕╨░╨╗╨╕╨╖╨░╤Ж╨╕╨╕ JSON
      const jsonStartTime = Date.now();
      const responseData = {
        request,
        requestSuppliers: await storage.getRequestSuppliers(id, userId),
        supplierResponses: await storage.getSupplierResponses(id, userId)
      };
      const jsonTime = Date.now() - jsonStartTime;
      const finalEndpointTime = Date.now() - endpointStartTime;
      
      console.log(`[Server] JSON serialization took ${jsonTime}ms, final endpoint time: ${finalEndpointTime}ms`);
      
      res.json(responseData);
    } catch (error) {
      console.error(`Error fetching request ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to fetch request details", error: String(error) });
    }
  });

  // Get full attachment content by response ID and filename
  app.get("/api/attachments/:responseId/:filename", requireAuth, async (req, res) => {
    try {
      const { responseId, filename } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log(`[Server] Fetching attachment ${filename} for response ${responseId} by user ${userId}`);

      // Get the supplier response with full attachment content
      const response = await db
        .select()
        .from(supplierResponses)
        .where(
          and(
            eq(supplierResponses.id, parseInt(responseId)),
            eq(supplierResponses.userId, userId)
          )
        )
        .limit(1);

      if (!response || response.length === 0) {
        return res.status(404).json({ message: "Response not found or access denied" });
      }

      const supplierResponse = response[0];
      const attachments = supplierResponse.attachments as any[];

      // Find the requested attachment
      const attachment = attachments.find((att: any) => att.filename === filename);
      
      if (!attachment || !attachment.content) {
        return res.status(404).json({ message: "Attachment not found or has no content" });
      }

      // Set appropriate headers for file download
      res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', Buffer.from(attachment.content, 'base64').length);

      // Send the file content
      res.send(Buffer.from(attachment.content, 'base64'));
      
      console.log(`[Server] Successfully served attachment ${filename} for response ${responseId}`);
    } catch (error) {
      console.error(`Error fetching attachment ${req.params.filename} for response ${req.params.responseId}:`, error);
      res.status(500).json({ message: "Failed to fetch attachment", error: String(error) });
    }
  });

  // Update status for a search request
  app.patch("/api/search-requests/:id/status", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      // Get the user ID from the authenticated user for data isolation
      const userId = req.user?.id;
      console.log(`[Server] Updating status for search request ID ${id} to '${status}' for user ID ${userId}`);

      // Update with userId to ensure users can only update their own requests
      const updatedRequest = await storage.updateSearchRequestStatus(id, status, userId);

      if (!updatedRequest) {
        return res.status(404).json({ message: `Request with ID ${id} not found or you don't have permission to update it` });
      }

      res.json(updatedRequest);
    } catch (error) {
      console.error("Error updating search request status:", error);
      res.status(500).json({ message: "Failed to update search request status" });
    }
  });

  // API ╤Н╨╜╨┤╨┐╨╛╨╕╨╜╤В╤Л ╨┤╨╗╤П ╤А╨░╨▒╨╛╤В╤Л ╤Б ╨│╤А╤Г╨┐╨┐╨░╨╝╨╕ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓

  // ╨Я╨╛╨╗╤Г╤З╨╡╨╜╨╕╨╡ ╨▓╤Б╨╡╤Е ╨│╤А╤Г╨┐╨┐ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓
  app.get("/api/contact-groups", requireAuth, async (req, res) => {
    try {
      // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ID ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨╕╨╖ ╨╛╨▒╤К╨╡╨║╤В╨░ req.user (╤Г╤Б╤В╨░╨╜╨╛╨▓╨╗╨╡╨╜╨╜╨╛╨│╨╛ middleware)
      const userId = req.user?.id;

      if (!userId) {
        console.error("[Server] User ID not found in authenticated request");
        return res.status(401).json({ error: "╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨╜╨╡ ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜ ╨╕╨╗╨╕ ╤Б╨╡╤Б╤Б╨╕╤П ╨╕╤Б╤В╨╡╨║╨╗╨░" });
      }

      console.log(`[Server] Fetching contact groups for user ID: ${userId}`);

      // SECURITY: Always filter by userId - even admins should only see their own groups
      // This prevents cross-user data contamination
      const groups = await storage.getContactGroups(userId);
      console.log(`[Server] Filtered to ${groups.length} groups belonging to user ${userId}`);

      // ╨Ю╨Я╨в╨Ш╨Ь╨Ш╨Ч╨Р╨ж╨Ш╨п: ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ╨║╨╛╨╗╨╕╤З╨╡╤Б╤В╨▓╨╛ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨╛╨┤╨╜╨╕╨╝ ╨╖╨░╨┐╤А╨╛╤Б╨╛╨╝ ╨┤╨╗╤П ╨▓╤Б╨╡╤Е ╨│╤А╤Г╨┐╨┐
      if (groups.length > 0) {
        try {
          const groupIds = groups.map(group => group.id);
          const contactCounts = await storage.getContactCountsByGroupIds(groupIds, userId);
          
          // ╨Ю╨▒╨╜╨╛╨▓╨╗╤П╨╡╨╝ contactCount ╨┤╨╗╤П ╨║╨░╨╢╨┤╨╛╨╣ ╨│╤А╤Г╨┐╨┐╤Л
          groups.forEach(group => {
            group.contactCount = contactCounts[group.id] || 0;
          });
        } catch (err) {
          console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨║╨╛╨╗╨╕╤З╨╡╤Б╤В╨▓╨░ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┤╨╗╤П ╨│╤А╤Г╨┐╨┐:", err);
          // ╨Т ╤Б╨╗╤Г╤З╨░╨╡ ╨╛╤И╨╕╨▒╨║╨╕ ╨╛╤Б╤В╨░╨▓╨╗╤П╨╡╨╝ ╨╕╤Б╤Е╨╛╨┤╨╜╤Л╨╡ ╨╖╨╜╨░╤З╨╡╨╜╨╕╤П contactCount
        }
      }

      res.json(groups);
    } catch (error) {
      console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨│╤А╤Г╨┐╨┐ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓:", error);
      res.status(500).json({ message: "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨┐╨╛╨╗╤Г╤З╨╕╤В╤М ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓", error: String(error) });
    }
  });

  // ╨б╨╛╨╖╨┤╨░╨╜╨╕╨╡ ╨╜╨╛╨▓╨╛╨╣ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓
  app.post("/api/contact-groups", requireAuth, async (req, res) => {
    try {
      // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ID ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨╕╨╖ ╨╛╨▒╤К╨╡╨║╤В╨░ req.user (╤Г╤Б╤В╨░╨╜╨╛╨▓╨╗╨╡╨╜╨╜╨╛╨│╨╛ middleware)
      const userId = req.user?.id;

      if (!userId) {
        console.error("[Server] User ID not found in authenticated request");
        return res.status(401).json({ error: "╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨╜╨╡ ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜ ╨╕╨╗╨╕ ╤Б╨╡╤Б╤Б╨╕╤П ╨╕╤Б╤В╨╡╨║╨╗╨░" });
      }

      console.log(`[Server] Creating new contact group for user ID: ${userId}`);

      const validatedData = insertContactGroupSchema.parse(req.body);

      // ╨Т╤Б╨╡╨│╨┤╨░ ╨┤╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ userId ╤В╨╡╨║╤Г╤Й╨╡╨│╨╛ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П
      validatedData.userId = userId;

      const newGroup = await storage.createContactGroup(validatedData);
      res.status(201).json(newGroup);
    } catch (error) {
      console.error("╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╤П ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓:", error);
      res.status(400).json({ message: "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╤Б╨╛╨╖╨┤╨░╤В╤М ╨│╤А╤Г╨┐╨┐╤Г ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓", error: String(error) });
    }
  });

  // ╨Я╨╛╨╗╤Г╤З╨╡╨╜╨╕╨╡ ╨║╨╛╨╜╨║╤А╨╡╤В╨╜╨╛╨╣ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┐╨╛ ID ╤Б ╨║╨╛╨╜╤В╨░╨║╤В╨░╨╝╨╕
  app.get("/api/contact-groups/:id", requireAuth, async (req, res) => {
    // ╨г╤Б╤В╨░╨╜╨░╨▓╨╗╨╕╨▓╨░╨╡╨╝ ╨╖╨░╨│╨╛╨╗╨╛╨▓╨║╨╕, ╨╖╨░╨┐╤А╨╡╤Й╨░╤О╤Й╨╕╨╡ ╨║╤Н╤И╨╕╤А╨╛╨▓╨░╨╜╨╕╨╡
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "╨Э╨╡╨║╨╛╤А╤А╨╡╨║╤В╨╜╤Л╨╣ ╤Д╨╛╤А╨╝╨░╤В ID" });
      }

      // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ ╨┐╤А╨╛╨▓╨╡╤А╨║╤Г ╨┤╨╛╤Б╤В╤Г╨┐╨░ - ╨│╤А╤Г╨┐╨┐╨░ ╨┤╨╛╨╗╨╢╨╜╨░ ╨┐╤А╨╕╨╜╨░╨┤╨╗╨╡╨╢╨░╤В╤М ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤О
      const userId = req.user?.id;
      console.log(`Checking access to contact group ${id} for user ${userId}`);

      const group = await storage.getContactGroupById(id, userId);
      if (!group) {
        return res.status(404).json({ message: `╨У╤А╤Г╨┐╨┐╨░ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╤Б ID ${id} ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨░ ╨╕╨╗╨╕ ╨╜╨╡╨┤╨╛╤Б╤В╤Г╨┐╨╜╨░` });
      }

      // ╨Я╨╛╨╗╤Г╤З╨╕╤В╤М ╨║╨╛╨╜╤В╨░╨║╤В╤Л ╨┤╨╗╤П ╨│╤А╤Г╨┐╨┐╤Л ╤Б ╤Г╤З╨╡╤В╨╛╨╝ userId ╨┤╨╗╤П ╨╕╨╖╨╛╨╗╤П╤Ж╨╕╨╕ ╨┤╨░╨╜╨╜╤Л╤Е
      const contacts = await storage.getContactItemsByGroupId(id, userId);
      console.log(`╨Э╨░╨╣╨┤╨╡╨╜╨╛ ${contacts.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┤╨╗╤П ╨│╤А╤Г╨┐╨┐╤Л ${id} ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ${userId}`);

      // ╨Т╨╡╤А╨╜╤Г╤В╤М ╨╛╨▒╤К╨╡╨║╤В ╤Б ╨│╤А╤Г╨┐╨┐╨╛╨╣ ╨╕ ╨║╨╛╨╜╤В╨░╨║╤В╨░╨╝╨╕
      res.json({
        group,
        contacts
      });
    } catch (error) {
      console.error(`╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╤Б ID ${req.params.id}:`, error);
      res.status(500).json({ message: "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨┐╨╛╨╗╤Г╤З╨╕╤В╤М ╨│╤А╤Г╨┐╨┐╤Г ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓", error: String(error) });
    }
  });

  // ╨Я╨╛╨╗╤Г╤З╨╡╨╜╨╕╨╡ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┤╨╗╤П ╨║╨╛╨╜╨║╤А╨╡╤В╨╜╨╛╨╣ ╨│╤А╤Г╨┐╨┐╤Л
  app.get("/api/contact-groups/:groupId/contacts", requireAuth, async (req, res) => {
    // ╨г╤Б╤В╨░╨╜╨░╨▓╨╗╨╕╨▓╨░╨╡╨╝ ╨╖╨░╨│╨╛╨╗╨╛╨▓╨╛╨║ JSON ╨╕ ╨╖╨░╨┐╤А╨╡╤Й╨░╨╡╨╝ ╨║╤Н╤И╨╕╤А╨╛╨▓╨░╨╜╨╕╨╡
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
      const groupId = parseInt(req.params.groupId);
      console.log(`╨Ч╨░╨┐╤А╨╛╤Б ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┤╨╗╤П ╨│╤А╤Г╨┐╨┐╤Л ${groupId}`);

      if (isNaN(groupId)) {
        console.error(`╨Э╨╡╨║╨╛╤А╤А╨╡╨║╤В╨╜╤Л╨╣ ID ╨│╤А╤Г╨┐╨┐╤Л: ${req.params.groupId}`);
        return res.status(400).json([]);  // ╨Т╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╨╝ ╨┐╤Г╤Б╤В╨╛╨╣ ╨╝╨░╤Б╤Б╨╕╨▓ ╨▓╨╝╨╡╤Б╤В╨╛ ╨╛╤И╨╕╨▒╨║╨╕
      }

      // ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝, ╨┐╤А╨╕╨╜╨░╨┤╨╗╨╡╨╢╨╕╤В ╨╗╨╕ ╨│╤А╤Г╨┐╨┐╨░ ╤В╨╡╨║╤Г╤Й╨╡╨╝╤Г ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤О
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "╨Э╨╡ ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜" });
      }

      // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤О ╨╛ ╨│╤А╤Г╨┐╨┐╨╡ ╤Б ╨┐╤А╨╛╨▓╨╡╤А╨║╨╛╨╣ ╨▓╨╗╨░╨┤╨╡╨╗╤М╤Ж╨░
      const group = await storage.getContactGroupById(groupId, userId);
      if (!group) {
        return res.status(404).json({ error: "╨У╤А╤Г╨┐╨┐╨░ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨░" });
      }

      const contacts = await storage.getContactItemsByGroupId(groupId, userId);
      console.log(`╨Э╨░╨╣╨┤╨╡╨╜╨╛ ${contacts.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┤╨╗╤П ╨│╤А╤Г╨┐╨┐╤Л ${groupId} ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ${userId}`);

      res.json(contacts);
    } catch (error) {
      console.error(`╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┤╨╗╤П ╨│╤А╤Г╨┐╨┐╤Л ${req.params.groupId}:`, error);
      // ╨Т ╤Б╨╗╤Г╤З╨░╨╡ ╨╛╤И╨╕╨▒╨║╨╕ ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╨╝ ╨┐╤Г╤Б╤В╨╛╨╣ ╨╝╨░╤Б╤Б╨╕╨▓, ╨░ ╨╜╨╡ ╨╛╤И╨╕╨▒╨║╤Г
      res.status(200).json([]);
    }
  });

  // ╨Ф╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╕╨╡ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨▓ ╨│╤А╤Г╨┐╨┐╤Г
  app.post("/api/contact-groups/:groupId/add-contacts", requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      console.log(`╨Ф╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╕╨╡ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨▓ ╨│╤А╤Г╨┐╨┐╤Г ${groupId}`);

      if (isNaN(groupId)) {
        console.error(`╨Э╨╡╨║╨╛╤А╤А╨╡╨║╤В╨╜╤Л╨╣ ID ╨│╤А╤Г╨┐╨┐╤Л: ${req.params.groupId}`);
        return res.status(400).json({ message: "╨Э╨╡╨▓╨╡╤А╨╜╤Л╨╣ ╤Д╨╛╤А╨╝╨░╤В ID ╨│╤А╤Г╨┐╨┐╤Л" });
      }

      const { contacts } = req.body;

      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ message: "╨Ъ╨╛╨╜╤В╨░╨║╤В╤Л ╨┤╨╛╨╗╨╢╨╜╤Л ╨▒╤Л╤В╤М ╨┐╤А╨╡╨┤╤Б╤В╨░╨▓╨╗╨╡╨╜╤Л ╨╝╨░╤Б╤Б╨╕╨▓╨╛╨╝" });
      }

      console.log(`╨Я╨╛╨┐╤Л╤В╨║╨░ ╨┤╨╛╨▒╨░╨▓╨╕╤В╤М ${contacts.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨▓ ╨│╤А╤Г╨┐╨┐╤Г ${groupId}`);

      // ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╤Б╤Г╤Й╨╡╤Б╤В╨▓╨╛╨▓╨░╨╜╨╕╨╡ ╨│╤А╤Г╨┐╨┐╤Л
      const userId = req.user?.id;
      const group = await storage.getContactGroupById(groupId, userId);
      if (!group) {
        return res.status(404).json({ message: "╨У╤А╤Г╨┐╨┐╨░ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨░" });
      }

      // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ╤Б╤Г╤Й╨╡╤Б╤В╨▓╤Г╤О╤Й╨╕╨╡ ╨║╨╛╨╜╤В╨░╨║╤В╤Л ╨┤╨╗╤П ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕ ╨┤╤Г╨▒╨╗╨╕╨║╨░╤В╨╛╨▓
      const existingContacts = await storage.getContactItemsByGroupId(groupId, userId);
      const existingEmails = new Set();

      // ╨б╨╛╨▒╨╕╤А╨░╨╡╨╝ ╨▓╤Б╨╡ ╤Б╤Г╤Й╨╡╤Б╤В╨▓╤Г╤О╤Й╨╕╨╡ email ╨▓ ╨╜╨╕╨╢╨╜╨╡╨╝ ╤А╨╡╨│╨╕╤Б╤В╤А╨╡ ╨┤╨╗╤П ╨▒╨╛╨╗╨╡╨╡ ╤В╨╛╤З╨╜╨╛╨│╨╛ ╤Б╤А╨░╨▓╨╜╨╡╨╜╨╕╤П
      existingContacts.forEach(contact => {
        if (contact.email) {
          existingEmails.add(contact.email.toLowerCase().trim());
        }
      });

      console.log(`╨Т ╨│╤А╤Г╨┐╨┐╨╡ ${groupId} ╨╜╨░╨╣╨┤╨╡╨╜╨╛ ${existingContacts.length} ╤Б╤Г╤Й╨╡╤Б╤В╨▓╤Г╤О╤Й╨╕╤Е ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓`);
      console.log(`╨б╤Г╤Й╨╡╤Б╤В╨▓╤Г╤О╤Й╨╕╨╡ email: ${Array.from(existingEmails).join(', ')}`);

      // ╨д╨╕╨╗╤М╤В╤А╤Г╨╡╨╝ ╤В╨╛╨╗╤М╨║╨╛ ╤Г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╨╡ ╨║╨╛╨╜╤В╨░╨║╤В╤Л, ╨┐╤А╨╛╨▓╨╡╤А╤П╤П email ╨┐╨╛╤Б╨╗╨╡ ╨┐╤А╨╕╨▓╨╡╨┤╨╡╨╜╨╕╤П ╨║ ╨╜╨╕╨╢╨╜╨╡╨╝╤Г ╤А╨╡╨│╨╕╤Б╤В╤А╤Г
      const uniqueContacts = contacts.filter(contact => {
        if (!contact.email) return true; // ╨Ъ╨╛╨╜╤В╨░╨║╤В╤Л ╨▒╨╡╨╖ email ╨▓╤Б╨╡╨│╨┤╨░ ╨┤╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝
        const normalizedEmail = contact.email.toLowerCase().trim();
        const isDuplicate = existingEmails.has(normalizedEmail);
        console.log(`╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╨║╨╛╨╜╤В╨░╨║╤В: ${contact.name} <${normalizedEmail}>`);
        console.log(`╨б╤Г╤Й╨╡╤Б╤В╨▓╤Г╤О╤Й╨╕╨╡ emails ╨▓ ╨│╤А╤Г╨┐╨┐╨╡: [${Array.from(existingEmails).join(', ')}]`);
        console.log(`╨н╤В╨╛ ╨┤╤Г╨▒╨╗╨╕╨║╨░╤В? ${isDuplicate}`);
        
        if (isDuplicate) {
          console.log(`╨Ю╨▒╨╜╨░╤А╤Г╨╢╨╡╨╜ ╨┤╤Г╨▒╨╗╨╕╨║╨░╤В email: ${normalizedEmail}`);
        }
        return !isDuplicate;
      });

      console.log(`╨Ю╤В╤Д╨╕╨╗╤М╤В╤А╨╛╨▓╨░╨╜╨╛ ${uniqueContacts.length} ╨╕╨╖ ${contacts.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┤╨╗╤П ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╕╤П`);

      if (uniqueContacts.length === 0) {
        return res.status(200).json({ 
          message: "╨Э╨╡╤В ╨╜╨╛╨▓╤Л╤Е ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┤╨╗╤П ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╕╤П", 
          added: 0 
        });
      }

      // ╨Я╨╡╤А╨╡╨┤ ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╕╨╡╨╝ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓, ╤Г╨▒╨╡╨┤╨╕╨╝╤Б╤П ╤З╤В╨╛ ╤Г ╨║╨░╨╢╨┤╨╛╨│╨╛ ╨┤╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝╨╛╨│╨╛ ╨║╨╛╨╜╤В╨░╨║╤В╨░ ╨▒╤Г╨┤╨╡╤В userId
      const contactsWithUserId = uniqueContacts.map(contact => ({
        ...contact,
        userId: userId, // ╨Т╨░╨╢╨╜╨╛: ╤Н╤В╨╛ ╨╛╨▒╨╡╤Б╨┐╨╡╤З╨╕╨▓╨░╨╡╤В ╨╕╨╖╨╛╨╗╤П╤Ж╨╕╤О ╨┤╨░╨╜╨╜╤Л╤Е ╨╝╨╡╨╢╨┤╤Г ╤А╨░╨╖╨╜╤Л╨╝╨╕ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П╨╝╨╕
        groupId: groupId // ╨г╨▒╨╡╨┤╨╕╨╝╤Б╤П, ╤З╤В╨╛ groupId ╤В╨╛╨╢╨╡ ╤Г╤Б╤В╨░╨╜╨╛╨▓╨╗╨╡╨╜ ╨┐╤А╨░╨▓╨╕╨╗╤М╨╜╨╛
      }));

      console.log(`╨Ф╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╕╨╡ ${contactsWithUserId.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╤Б userId=${userId} ╨▓ ╨│╤А╤Г╨┐╨┐╤Г ${groupId}`);

      // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ ╨║╨╛╨╜╤В╨░╨║╤В╤Л ╨▓ ╨│╤А╤Г╨┐╨┐╤Г ╤Б userId ╨┤╨╗╤П ╨╕╨╖╨╛╨╗╤П╤Ж╨╕╨╕ ╨┤╨░╨╜╨╜╤Л╤Е
      const result = await storage.addContactsToGroup(groupId, contactsWithUserId, userId);

      res.status(200).json({ 
        message: `╨Ф╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╛ ${result.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨▓ ╨│╤А╤Г╨┐╨┐╤Г ${groupId}`,
        added: result.length,
        contacts: result
      });

    } catch (error) {
      console.error(`╨Ю╤И╨╕╨▒╨║╨░ ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╕╤П ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨▓ ╨│╤А╤Г╨┐╨┐╤Г ${req.params.groupId}:`, error);
      res.status(500).json({ message: "╨Ю╤И╨╕╨▒╨║╨░ ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╕╤П ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨▓ ╨│╤А╤Г╨┐╨┐╤Г" });
    }
  });

  // ╨Ю╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨╕╨╡ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┐╨╛ ID
  app.put("/api/contact-groups/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "╨Э╨╡╨║╨╛╤А╤А╨╡╨║╤В╨╜╤Л╨╣ ╤Д╨╛╤А╨╝╨░╤В ID" });
      }

      const validatedData = insertContactGroupSchema.parse(req.body);
      const updatedGroup = await storage.updateContactGroup(id, validatedData);

      if (!updatedGroup) {
        return res.status(404).json({ message: `╨У╤А╤Г╨┐╨┐╨░ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╤Б ID ${id} ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨░` });
      }

      console.log(`╨У╤А╤Г╨┐╨┐╨░ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╤Б ID ${id} ╤Г╤Б╨┐╨╡╤И╨╜╨╛ ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨░`);
      res.json(updatedGroup);
    } catch (error) {
      console.error(`╨Ю╤И╨╕╨▒╨║╨░ ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨╕╤П ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ${req.params.id}:`, error);
      res.status(400).json({ message: "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨╛╨▒╨╜╨╛╨▓╨╕╤В╤М ╨│╤А╤Г╨┐╨┐╤Г ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓", error: String(error) });
    }
  });

  // ╨г╨┤╨░╨╗╨╡╨╜╨╕╨╡ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┐╨╛ ID
  app.post("/api/contact-groups/:id/delete", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "╨Э╨╡╨║╨╛╤А╤А╨╡╨║╤В╨╜╤Л╨╣ ╤Д╨╛╤А╨╝╨░╤В ID" });
      }

      // ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╤Б╤Г╤Й╨╡╤Б╤В╨▓╨╛╨▓╨░╨╜╨╕╨╡ ╨│╤А╤Г╨┐╨┐╤Л
      const userId = req.user?.id;
      const group = await storage.getContactGroupById(id, userId);
      if (!group) {
        return res.status(404).json({ success: false, message: `╨У╤А╤Г╨┐╨┐╨░ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╤Б ID ${id} ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨░` });
      }

      // ╨г╨┤╨░╨╗╤П╨╡╨╝ ╨│╤А╤Г╨┐╨┐╤Г
      const success = await storage.deleteContactGroup(id);

      if (success) {
        console.log(`╨У╤А╤Г╨┐╨┐╨░ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╤Б ID ${id} ╤Г╤Б╨┐╨╡╤И╨╜╨╛ ╤Г╨┤╨░╨╗╨╡╨╜╨░`);
        res.json({ success: true, message: `╨У╤А╤Г╨┐╨┐╨░ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ "${group.name}" ╤Г╤Б╨┐╨╡╤И╨╜╨╛ ╤Г╨┤╨░╨╗╨╡╨╜╨░` });
      } else {
        console.error(`╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╤Г╨┤╨░╨╗╨╕╤В╤М ╨│╤А╤Г╨┐╨┐╤Г ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╤Б ID ${id}`);
        res.status(500).json({ success: false, message: "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╤Г╨┤╨░╨╗╨╕╤В╤М ╨│╤А╤Г╨┐╨┐╤Г ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓" });
      }
    } catch (error) {
      console.error(`╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╤Г╨┤╨░╨╗╨╡╨╜╨╕╨╕ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╤Б ID ${req.params.id}:`, error);
      res.status(500).json({ success: false, message: "╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╤Г╨┤╨░╨╗╨╡╨╜╨╕╨╕ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓", error: String(error) });
    }
  });

  // ╨Ю╤В╨┐╤А╨░╨▓╨║╨░ email ╨┐╨╛ ╨│╤А╤Г╨┐╨┐╨╡ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓
  app.post("/api/contact-groups/send-email", requireAuth, async (req, res) => {
    try {
      const { groupId, subject, message, contactIds = [], attachments = [] } = req.body;

      if (!groupId || !subject || !message) {
        return res.status(400).json({ error: "╨Ю╤В╤Б╤Г╤В╤Б╤В╨▓╤Г╤О╤В ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╨╡ ╨┐╨╛╨╗╤П" });
      }

      // Validate that we have at least one contact
      if (!contactIds.length) {
        return res.status(400).json({ error: "╨Э╨╡ ╨▓╤Л╨▒╤А╨░╨╜╨╛ ╨╜╨╕ ╨╛╨┤╨╜╨╛╨│╨╛ ╨║╨╛╨╜╤В╨░╨║╤В╨░" });
      }

      // Get selected contacts
      const selectedContacts = [];
      for (const contactId of contactIds) {
        try {
          const contact = await storage.getContactById(parseInt(String(contactId)));
          if (contact) {
            selectedContacts.push(contact);
          }
        } catch (err) {
          console.error(`╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨║╨╛╨╜╤В╨░╨║╤В╨░ ╤Б ID ${contactId}:`, err);
        }
      }

      console.log(`╨Т╤Л╨▒╤А╨░╨╜╨╛ ${selectedContacts.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┤╨╗╤П ╨╛╤В╨┐╤А╨░╨▓╨║╨╕`);

      if (selectedContacts.length === 0) {
        return res.status(400).json({ error: "╨Э╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨╛ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┤╨╗╤П ╨╛╤В╨┐╤А╨░╨▓╨║╨╕" });
      }

      // Send email to all selected contacts using our API
      const supplierIds = selectedContacts.map(contact => contact.id);
      const payload = {
        suppliers: supplierIds,
        subject: subject,
        message: message,
        requestId: 0, // ╨Т╤А╨╡╨╝╨╡╨╜╨╜╤Л╨╣ ╨╖╨░╨┐╤А╨╛╤Б
        attachments: attachments || [],
        fromContactGroup: true // ╨Т╨░╨╢╨╜╤Л╨╣ ╤Д╨╗╨░╨│: ╤Н╤В╨╕ ID ╨╕╨╖ ╨│╤А╤Г╨┐╨┐ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓
      };

      // ╨Ю╤В╨┐╤А╨░╨▓╨╗╤П╨╡╨╝ ╨╜╨░ ╨╜╨░╤И ╤Б╨╛╨▒╤Б╤В╨▓╨╡╨╜╨╜╤Л╨╣ API endpoint
      // ╨н╤В╨╛ ╨┐╨╛╨╖╨▓╨╛╨╗╤П╨╡╤В ╨┐╨╡╤А╨╡╨╕╤Б╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╤М ╨▓╤Б╤О ╨╗╨╛╨│╨╕╨║╤Г ╨╛╤В╨┐╤А╨░╨▓╨║╨╕
      const sendResponse = await new Promise((resolve) => {
        // ╨Ш╨╖╨╝╨╡╨╜╤П╨╡╨╝ ╤В╨╕╨┐ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓ ╨┤╨╗╤П ╨╛╨▒╤А╨░╨▒╨╛╤В╤З╨╕╨║╨░, ╤З╤В╨╛╨▒╤Л ╨╛╨╜ ╨┐╤А╨╕╨╜╨╕╨╝╨░╨╗ ╤З╨░╤Б╤В╨╕╤З╨╜╤Л╨╡ ╨╛╨▒╤К╨╡╨║╤В╤Л
        const reqHandler = (req: Partial<Request> & { 
          method: string; 
          url: string; 
          body: any; 
          headers: any; 
        }, res: any) => {
          const originalJson = res.json;
          res.json = function (body: any) {
            resolve(body);
            return originalJson.call(this, body);
          };

          app._router.handle(req as Request, res as Response, () => {
            resolve({ error: 'Internal routing error' });
          });
        };

        // ╨б╨╛╨╖╨┤╨░╨╡╨╝ ╨▓╨╕╤А╤В╤Г╨░╨╗╤М╨╜╤Л╨╣ ╨╖╨░╨┐╤А╨╛╤Б ╨║ /api/send-email
        // ╨б╨╛╨╖╨┤╨░╨╡╨╝ ╨╛╨▒╤К╨╡╨║╤В ╤Б ╨▒╨░╨╖╨╛╨▓╤Л╨╝╨╕ ╤Б╨▓╨╛╨╣╤Б╤В╨▓╨░╨╝╨╕, ╨╖╨░╤В╨╡╨╝ ╤А╨░╤Б╤И╨╕╤А╤П╨╡╨╝ ╨╡╨│╨╛ ╨╕╨╖ req,
        // ╨╖╨░╤В╨╡╨╝ ╨┐╨╡╤А╨╡╨╛╨┐╤А╨╡╨┤╨╡╨╗╤П╨╡╨╝ ╨╜╤Г╨╢╨╜╤Л╨╡ ╤Б╨▓╨╛╨╣╤Б╤В╨▓╨░ ╨┤╨╗╤П ╨▓╨╕╤А╤В╤Г╨░╨╗╤М╨╜╨╛╨│╨╛ ╨╖╨░╨┐╤А╨╛╤Б╨░
        // ╨б╨╛╨╖╨┤╨░╨╡╨╝ ╨╛╨▒╤К╨╡╨║╤В ╨╖╨░╨┐╤А╨╛╤Б╨░ ╤Б ╤В╨╛╨╗╤М╨║╨╛ ╨╜╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╤Л╨╝╨╕ ╤Б╨▓╨╛╨╣╤Б╤В╨▓╨░╨╝╨╕
        const mockReq = Object.assign({}, req, {
          method: 'POST',
          url: '/api/send-email',
          body: payload,
          headers: Object.assign({}, req.headers, {
            'content-type': 'application/json'
          })
        });

        // ╨б╨╛╨╖╨┤╨░╨╡╨╝ ╨╛╨▒╤К╨╡╨║╤В ╨╛╤В╨▓╨╡╤В╨░ ╤Б ╨╜╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╤Л╨╝ ╨╝╨╕╨╜╨╕╨╝╤Г╨╝╨╛╨╝ ╤Б╨▓╨╛╨╣╤Б╤В╨▓
        // TypeScript ╨╜╨╡ ╤Б╤В╤А╨╛╨│ ╨║ ╨┤╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╤Л╨╝ ╤Б╨▓╨╛╨╣╤Б╤В╨▓╨░╨╝ ╨┐╤А╨╕ ╨┐╤А╨╕╤Б╨▓╨░╨╕╨▓╨░╨╜╨╕╨╕, ╨┐╨╛╤Н╤В╨╛╨╝╤Г ╨╕╨╖╨▒╨╡╨│╨░╨╡╨╝ ╨╛╤И╨╕╨▒╨╛╨║ ╨║╨╛╨╝╨┐╨╕╨╗╤П╤Ж╨╕╨╕
        const mockRes = Object.assign({}, {
          setHeader: () => {},
          getHeader: () => {},
          status: res.status.bind(res),
          send: res.send.bind(res),
          json: res.json.bind(res),
          sendStatus: res.sendStatus.bind(res)
        });

        reqHandler(mockReq, mockRes);
      });

      res.json(sendResponse);
    } catch (error) {
      console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨╛╤В╨┐╤А╨░╨▓╨║╨╕ email ╨┤╨╗╤П ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓:", error);
      res.status(500).json({ error: String(error), message: "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨╛╤В╨┐╤А╨░╨▓╨╕╤В╤М email" });
    }
  });

  // Add a supplier to a contact group
  app.post("/api/supplier-contact-groups", requireAuth, async (req, res) => {
    try {
      const validatedData = insertRequestSupplierGroupSchema.parse(req.body);

      console.log("╨Ф╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╕╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨░ ╨▓ ╨│╤А╤Г╨┐╨┐╤Г ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓:", validatedData);

      // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨░
      const requestSupplier = await storage.getRequestSupplierById(validatedData.requestSupplierId);
      if (!requestSupplier) {
        return res.status(404).json({ message: "╨Я╨╛╤Б╤В╨░╨▓╤Й╨╕╨║ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜" });
      }

      // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ╤Б╤Г╤Й╨╡╤Б╤В╨▓╤Г╤О╤Й╨╕╨╡ ╨║╨╛╨╜╤В╨░╨║╤В╤Л ╨┤╨╗╤П ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕ ╨┤╤Г╨▒╨╗╨╕╨║╨░╤В╨╛╨▓ email
      const existingContacts = await storage.getContactItemsByGroupId(validatedData.contactGroupId);
      const existingEmails = new Set(existingContacts.map(contact => 
        contact.email?.toLowerCase() || ''
      ));

      // ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝, ╨╡╤Б╤В╤М ╨╗╨╕ ╤Г╨╢╨╡ ╨║╨╛╨╜╤В╨░╨║╤В ╤Б ╤В╨░╨║╨╕╨╝ email ╨▓ ╨│╤А╤Г╨┐╨┐╨╡
      if (requestSupplier.supplierEmail && existingEmails.has(requestSupplier.supplierEmail.toLowerCase())) {
        return res.status(409).json({ 
          message: "╨Ъ╨╛╨╜╤В╨░╨║╤В ╤Б ╤В╨░╨║╨╕╨╝ email ╤Г╨╢╨╡ ╤Б╤Г╤Й╨╡╤Б╤В╨▓╤Г╨╡╤В ╨▓ ╤Н╤В╨╛╨╣ ╨│╤А╤Г╨┐╨┐╨╡", 
          duplicate: true 
        });
      }

      // ╨Х╤Б╨╗╨╕ ╨┤╤Г╨▒╨╗╨╕╨║╨░╤В╨╛╨▓ ╨╜╨╡╤В, ╨┤╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨░ ╨▓ ╨│╤А╤Г╨┐╨┐╤Г
      const newRelation = await storage.addSupplierToContactGroup(validatedData);

      console.log("╨Я╨╛╤Б╤В╨░╨▓╤Й╨╕╨║ ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜ ╨▓ ╨│╤А╤Г╨┐╨┐╤Г ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓:", newRelation);

      res.status(201).json(newRelation);
    } catch (error) {
      console.error("Error adding supplier to contact group:", error);
      res.status(400).json({ message: "Failed to add supplier to contact group", error: String(error) });
    }
  });

  // ╨б╨╛╨╖╨┤╨░╨╜╨╕╨╡ ╨╜╨╛╨▓╨╛╨│╨╛ ╨║╨╛╨╜╤В╨░╨║╤В╨╜╨╛╨│╨╛ ╤Н╨╗╨╡╨╝╨╡╨╜╤В╨░ ╨┤╨╗╤П ╨│╤А╤Г╨┐╨┐╤Л
  app.post("/api/contact-items", requireAuth, async (req, res) => {
    try {
      // ╨г╨▒╨╡╨┤╨╕╨╝╤Б╤П, ╤З╤В╨╛ ╤Г ╨╜╨░╤Б ╨╡╤Б╤В╤М ╨▓╤Б╨╡ ╨╜╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╤Л╨╡ ╨┐╨╛╨╗╤П
      const validatedData = insertContactItemSchema.parse(req.body);

      console.log("╨б╨╛╨╖╨┤╨░╨╜╨╕╨╡ ╨╜╨╛╨▓╨╛╨│╨╛ ╨║╨╛╨╜╤В╨░╨║╤В╨░:", validatedData);

      // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ID ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨╕╨╖ ╤В╨╛╨║╨╡╨╜╨░
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "╨Э╨╡ ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜" });
      }

      // ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝, ╨┐╤А╨╕╨╜╨░╨┤╨╗╨╡╨╢╨╕╤В ╨╗╨╕ ╨│╤А╤Г╨┐╨┐╨░ ╤В╨╡╨║╤Г╤Й╨╡╨╝╤Г ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤О
      const groupId = validatedData.groupId;
      const group = await storage.getContactGroupById(groupId, userId);

      if (!group) {
        return res.status(404).json({ error: "╨У╤А╤Г╨┐╨┐╨░ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨░" });
      }

      // ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝, ╤З╤В╨╛ ╨│╤А╤Г╨┐╨┐╨░ ╨┐╤А╨╕╨╜╨░╨┤╨╗╨╡╨╢╨╕╤В ╤В╨╡╨║╤Г╤Й╨╡╨╝╤Г ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤О
      if (group.userId !== userId) {
        console.warn(`╨Я╨╛╨┐╤Л╤В╨║╨░ ╨┤╨╛╨▒╨░╨▓╨╕╤В╤М ╨║╨╛╨╜╤В╨░╨║╤В ╨▓ ╤З╤Г╨╢╤Г╤О ╨│╤А╤Г╨┐╨┐╤Г: ╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ${userId} ╨┐╤Л╤В╨░╨╡╤В╤Б╤П ╨┤╨╛╨▒╨░╨▓╨╕╤В╤М ╨║╨╛╨╜╤В╨░╨║╤В ╨▓ ╨│╤А╤Г╨┐╨┐╤Г ${groupId} ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ${group.userId}`);
        return res.status(403).json({ error: "╨Э╨╡╤В ╨┤╨╛╤Б╤В╤Г╨┐╨░ ╨║ ╤Н╤В╨╛╨╣ ╨│╤А╤Г╨┐╨┐╨╡" });
      }

      // ╨Ш╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╨╝ ╨╝╨╡╤В╨╛╨┤ storage ╨▓╨╝╨╡╤Б╤В╨╛ ╨┐╤А╤П╨╝╨╛╨│╨╛ ╨╖╨░╨┐╤А╨╛╤Б╨░ ╨▓ ╨▒╨░╨╖╤Г ╨┤╨░╨╜╨╜╤Л╤Е
      // ╨Я╨╡╤А╨╡╨┤╨░╨╡╨╝ userId ╨┤╨╗╤П ╨╕╨╖╨╛╨╗╤П╤Ж╨╕╨╕ ╨┤╨░╨╜╨╜╤Л╤Е
      const existingContacts = await storage.getContactItemsByEmail(validatedData.groupId, validatedData.email, userId);

      // ╨Х╤Б╨╗╨╕ ╨║╨╛╨╜╤В╨░╨║╤В ╤Г╨╢╨╡ ╤Б╤Г╤Й╨╡╤Б╤В╨▓╤Г╨╡╤В, ╨▓╨╛╨╖╨▓╤А╨░╤Й╨░╨╡╨╝ ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤О ╨╛ ╨┤╤Г╨▒╨╗╨╕╨║╨░╤В╨╡
      if (existingContacts && existingContacts.length > 0) {
        console.log(`╨Ъ╨╛╨╜╤В╨░╨║╤В ╤Б email ${validatedData.email} ╤Г╨╢╨╡ ╤Б╤Г╤Й╨╡╤Б╤В╨▓╤Г╨╡╤В ╨▓ ╨│╤А╤Г╨┐╨┐╨╡ ${validatedData.groupId}`);
        return res.status(200).json({ 
          duplicate: true, 
          id: existingContacts[0].id,
          email: validatedData.email 
        });
      }

      // ╨б╨╛╨╖╨┤╨░╨╡╨╝ ╨╜╨╛╨▓╤Л╨╣ ╨║╨╛╨╜╤В╨░╨║╤В ╨╕ ╨┤╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ userId ╨┤╨╗╤П ╨╕╨╖╨╛╨╗╤П╤Ж╨╕╨╕ ╨┤╨░╨╜╨╜╤Л╤Е
      const contactWithUserId = {
        ...validatedData,
        userId: userId // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ user ID ╨┤╨╗╤П ╨┐╤А╨░╨▓╨╕╨╗╤М╨╜╨╛╨╣ ╨╕╨╖╨╛╨╗╤П╤Ж╨╕╨╕ ╨╝╨╡╨╢╨┤╤Г ╨░╨║╨║╨░╤Г╨╜╤В╨░╨╝╨╕
      };
      const newContact = await storage.createContactItem(contactWithUserId);

      console.log("╨Э╨╛╨▓╤Л╨╣ ╨║╨╛╨╜╤В╨░╨║╤В ╤Б╨╛╨╖╨┤╨░╨╜:", newContact);

      res.status(201).json(newContact);
    } catch (error) {
      console.error("╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╤П ╨║╨╛╨╜╤В╨░╨║╤В╨░:", error);
      res.status(400).json({ message: "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╤Б╨╛╨╖╨┤╨░╤В╤М ╨║╨╛╨╜╤В╨░╨║╤В", error: String(error) });
    }
  });

  // ╨Ь╨░╤А╤И╤А╤Г╤В ╨┤╨╗╤П ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨╕╤П ╨║╨╛╨╜╤В╨░╨║╤В╨░
  app.put("/api/contact-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      const updateData = req.body;
      const updatedContact = await storage.updateContactItem(id, updateData);

      if (!updatedContact) {
        return res.status(404).json({ message: `Contact with ID ${id} not found` });
      }

      res.json(updatedContact);
    } catch (error) {
      console.error(`Error updating contact ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to update contact", error: String(error) });
    }
  });

  // ╨Ь╨░╤А╤И╤А╤Г╤В ╨┤╨╗╤П ╤Г╨┤╨░╨╗╨╡╨╜╨╕╤П ╨║╨╛╨╜╤В╨░╨║╤В╨░
  app.delete("/api/contact-items/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ID ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨╕╨╖ ╤В╨╛╨║╨╡╨╜╨░
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "╨Э╨╡ ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜" });
      }

      // ╨б╨╜╨░╤З╨░╨╗╨░ ╨┐╨╛╨╗╤Г╤З╨░╨╡╨╝ ╨║╨╛╨╜╤В╨░╨║╤В, ╤З╤В╨╛╨▒╤Л ╤Г╨╖╨╜╨░╤В╤М ╨╡╨│╨╛ ╨│╤А╤Г╨┐╨┐╤Г
      const contact = await storage.getContactById(id);
      if (!contact) {
        return res.status(404).json({ message: `╨Ъ╨╛╨╜╤В╨░╨║╤В ╤Б ID ${id} ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜` });
      }

      // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤О ╨╛ ╨│╤А╤Г╨┐╨┐╨╡
      const groupId = contact.groupId;
      const group = await storage.getContactGroupById(groupId, userId);

      if (!group) {
        return res.status(404).json({ error: "╨У╤А╤Г╨┐╨┐╨░ ╨║╨╛╨╜╤В╨░╨║╤В╨░ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨░" });
      }

      // ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝, ╤З╤В╨╛ ╨│╤А╤Г╨┐╨┐╨░ ╨┐╤А╨╕╨╜╨░╨┤╨╗╨╡╨╢╨╕╤В ╤В╨╡╨║╤Г╤Й╨╡╨╝╤Г ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤О
      if (group.userId !== userId) {
        console.warn(`╨Я╨╛╨┐╤Л╤В╨║╨░ ╤Г╨┤╨░╨╗╨╕╤В╤М ╨║╨╛╨╜╤В╨░╨║╤В ╨╕╨╖ ╤З╤Г╨╢╨╛╨╣ ╨│╤А╤Г╨┐╨┐╤Л: ╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ${userId} ╨┐╤Л╤В╨░╨╡╤В╤Б╤П ╤Г╨┤╨░╨╗╨╕╤В╤М ╨║╨╛╨╜╤В╨░╨║╤В ${id} ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л ${groupId} ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ${group.userId}`);
        return res.status(403).json({ error: "╨Э╨╡╤В ╨┤╨╛╤Б╤В╤Г╨┐╨░ ╨║ ╤Н╤В╨╛╨╣ ╨│╤А╤Г╨┐╨┐╨╡" });
      }

      const success = await storage.deleteContactItem(id);

      if (!success) {
        return res.status(404).json({ message: `Contact with ID ${id} not found or could not be deleted` });
      }

      res.json({ success: true, message: "Contact deleted successfully" });
    } catch (error) {
      console.error(`Error deleting contact ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to delete contact", error: String(error) });
    }
  });

  // On-demand email checking endpoint
app.post("/api/check-emails", requireAuth, async (req, res) => {
  try {
    console.log("\nЁЯФН PERSONAL EMAIL CHECK REQUEST RECEIVED");
    console.log("User:", req.user?.username, "ID:", req.user?.id);
    console.log("Timestamp:", new Date().toISOString());

    const requestId = req.body.requestId;
    console.log("Request ID from client:", requestId);
    
    // Get user's email configuration for debugging
    try {
      const userEmailConfig = await storage.getUserEmailConfig(req.user.id);
      console.log(`\nЁЯУз USER EMAIL CONFIG FOR ID ${req.user.id}:`);
      console.log("- Email Account:", userEmailConfig?.emailAccount || "NOT SET");
      console.log("- Email Configured:", userEmailConfig?.emailConfigured || false);
      console.log("- Has Password:", !!userEmailConfig?.emailPassword);
      console.log("- IMAP Host:", userEmailConfig?.imapHost || "imap.mail.ru");
      console.log("- IMAP Port:", userEmailConfig?.imapPort || 993);
    } catch (configError) {
      console.error("тЭМ Error getting user email config:", configError);
    }

    // Validate user authentication
    if (!req.user || !req.user.id) {
      console.error("No authenticated user found");
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        newResponses: 0
      });
    }

    // Log IMAP configuration status (without exposing credentials)
    console.log("IMAP Configuration Status:");
    console.log("- IMAP_USER:", process.env.IMAP_USER ? "Set" : "Not set");
    console.log("- IMAP_PASSWORD:", process.env.IMAP_PASSWORD ? "Set" : "Not set");
    console.log("- IMAP_HOST:", process.env.IMAP_HOST ? "Set" : "Not set");
    console.log("- IMAP_PORT:", process.env.IMAP_PORT ? "Set" : "Not set");
    console.log("- IMAP_TLS:", process.env.IMAP_TLS || "true");

    const result = await personalImapService.checkEmailsOnDemand(requestId, req.user.id);

    res.json({
      success: result.success,
      message: result.message,
      newResponses: result.newResponses
    });
  } catch (error) {
    console.error("Error in email checking endpoint:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
      newResponses: 0
    });
  }
});

  // API ╤Н╨╜╨┤╨┐╨╛╨╕╨╜╤В ╨┤╨╗╤П ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨╕╤П ╨│╤А╤Г╨┐╨┐ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┤╨╗╤П ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨░
  app.post("/api/suppliers/:id/groups", requireAuth, async (req, res) => {
    try {
      const supplierId = parseInt(req.params.id);
      const { groupIds } = req.body;

      if (!Array.isArray(groupIds)) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid request: groupIds must be an array"
        });
      }

      // Convert string IDs to numbers if needed
      const parsedGroupIds = groupIds.map(id => typeof id === 'string' ? parseInt(id) : id);

      console.log(`Updating groups for supplier ${supplierId} with groups:`, parsedGroupIds);

      try {
        await storage.updateSupplierGroups(supplierId, parsedGroupIds);
        res.status(200).json({ 
          success: true,
          message: "Groups updated successfully"
        });
      } catch (error) {
        console.error(`Error updating groups for supplier ${supplierId}:`, error);
        res.status(400).json({ 
          success: false,
          message: "Failed to update groups",
          error: String(error)
        });
      }
    } catch (error) {
      console.error("Error updating supplier groups:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to update contact groups",
        error: String(error)
      });
    }
  });

  // ╨Ь╨░╤А╤И╤А╤Г╤В ╨┤╨╗╤П ╨╛╤В╨┐╤А╨░╨▓╨║╨╕ ╨╛╤В╨▓╨╡╤В╨╛╨▓ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨░╨╝
  app.post("/api/supplier-responses/:id/reply", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        console.log("User ID missing in authenticated request");
        return res.status(401).json({ error: "╨Э╨╡ ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid response ID format" });
      }

      const { content, attachments = [] } = req.body;
      if (!content || typeof content !== 'string' || content.trim() === '') {
        return res.status(400).json({ message: "Email content is required" });
      }

      // Get the response to find the supplier's email
      const response = await storage.getSupplierResponseById(id);
      if (!response) {
        return res.status(404).json({ message: `Response with ID ${id} not found` });
      }

      // Get the request to include in email thread
      const request = await storage.getSearchRequest(response.requestId);
      if (!request) {
        return res.status(404).json({ message: `Associated request not found` });
      }

      // Check if the request belongs to the authenticated user
      if (request.userId !== userId) {
        console.log(`Unauthorized access attempt: User ${userId} trying to access request ${request.id} owned by ${request.userId}`);
        return res.status(403).json({ error: "╨г ╨▓╨░╤Б ╨╜╨╡╤В ╨┤╨╛╤Б╤В╤Г╨┐╨░ ╨║ ╤Н╤В╨╛╨╝╤Г ╨╖╨░╨┐╤А╨╛╤Б╤Г" });
      }

      // Enhanced sanitization of attachments for replies with async processing for large files
      let sanitizedAttachments: {
        filename: string;
        contentType: string;
        content: string;
        encoding?: string;
        size?: number;
      }[] = [];

      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        console.log(`Reply includes ${attachments.length} attachments`);

        // Process attachments asynchronously to avoid blocking the main thread
        const processAttachment = async (attachment: any) => {
          if (!attachment.filename || !attachment.contentType || !attachment.content) {
            console.warn(`Attachment in reply missing required fields, trying to fix`);
            return {
              filename: attachment.filename || 'unnamed_file.bin',
              contentType: attachment.contentType || 'application/octet-stream',
              content: attachment.content || '',
              encoding: 'base64',
              size: attachment.size || 0
            };
          }

          // Check if content is already a valid base64 string
          const isValidBase64 = (str: string): boolean => {
            if (str.length % 4 !== 0) return false;
            return /^[A-Za-z0-9+/=]+$/.test(str);
          };

          // Properly handle content encoding
          let processedContent = attachment.content;

          // If content is not valid base64, let's handle it appropriately
          if (typeof processedContent === 'string' && !isValidBase64(processedContent)) {
            console.log(`Attachment content is not valid base64, converting: ${attachment.filename}`);
            try {
              // For text content, encode it properly
              processedContent = Buffer.from(processedContent).toString('base64');
            } catch (error) {
              console.warn(`Error converting attachment content to base64:`, error);
            }
          }

          return {
            filename: attachment.filename,
            contentType: attachment.contentType,
            content: processedContent,
            encoding: 'base64',
            size: typeof processedContent === 'string' ? processedContent.length : 0
          };
        };

        // Process all attachments in parallel with Promise.allSettled to handle errors gracefully
        const attachmentPromises = attachments.map(processAttachment);
        const results = await Promise.allSettled(attachmentPromises);
        
        // Filter successful results and valid content
        sanitizedAttachments = results
          .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
          .map(result => result.value)
          .filter(attachment => attachment.content && attachment.content.length > 0);

        console.log(`Processed ${sanitizedAttachments.length} valid attachments out of ${attachments.length} for reply`);
      }

      // Prepare the email subject
      const subject = `RE: ${(response as any).subject || `Request: ${request.productName}`}`;

      // Send the email with sanitized attachments
      try {
        // Create message history to include in the reply
        let emailContent = content;

        // Add original message content to the reply as a quote
        if (response.content) {
          const responseDate = response.responseDate ? new Date(response.responseDate) : new Date();
          emailContent += `\n\n-------------------------\n╨Ю╤А╨╕╨│╨╕╨╜╨░╨╗╤М╨╜╨╛╨╡ ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╡ ╨╛╤В ${response.supplierName || response.supplierEmail} (${responseDate.toLocaleString('ru-RU')}):\n\n${response.content}`;
        }

        // Add request details if available
        if (request.productName) {
          emailContent += `\n\n-------------------------\n╨Ч╨░╨┐╤А╨╛╤Б: ${request.productName}`;
          if (request.productDescription) {
            emailContent += `\n╨Ю╨┐╨╕╤Б╨░╨╜╨╕╨╡: ${request.productDescription}`;
          }
        }

        // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ID ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П, ╨╛╤В╨┐╤А╨░╨▓╨╗╤П╤О╤Й╨╡╨│╨╛ ╨╛╤В╨▓╨╡╤В
        const userId = req.user?.id || 1; // ╨Ш╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╨╝ 1 ╨║╨░╨║ ID ╨┐╨╛ ╤Г╨╝╨╛╨╗╤З╨░╨╜╨╕╤О ╨▓ ╤А╨╡╨╢╨╕╨╝╨╡ ╤А╨░╨╖╤А╨░╨▒╨╛╤В╨║╨╕

        const success = await sendEmail(
          response.supplierEmail,
          subject,
          emailContent,
          {
            attachments: sanitizedAttachments, // Use sanitized attachments instead of raw ones
            userId: userId, // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ ID ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П ╨┤╨╗╤П ╨▓╨║╨╗╤О╤З╨╡╨╜╨╕╤П ╨▒╨╕╨╖╨╜╨╡╤Б-╨║╨░╤А╤В╨╛╤З╨║╨╕
            requestId: response.requestId, // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ requestId 
            replyTo: response.supplierEmail // ╨Ш╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╨╝ email ╨║╨░╨║ replyTo
          }
        );

        if (success) {
          // Update the response as replied to
          await storage.updateSupplierResponse(id, { isRepliedTo: true });

          // ╨Э╨░╨╣╨┤╨╡╨╝ requestSupplierId ╨┤╨╗╤П ╤Н╤В╨╛╨│╨╛ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨░ ╨╕ ╨╖╨░╨┐╤А╨╛╤Б╨░
          const requestSupplier = await storage.getRequestSupplierByRequestAndEmail(
            response.requestId, 
            response.supplierEmail
          );

          if (requestSupplier) {
            // ╨б╨╛╤Е╤А╨░╨╜╤П╨╡╨╝ ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╡ ╨▓ ╨╕╤Б╤В╨╛╤А╨╕╨╕ ╨┐╨╡╤А╨╡╨┐╨╕╤Б╨║╨╕ ╤Б ╤Б╨░╨╜╨╕╤В╨╕╨╖╨╕╤А╨╛╨▓╨░╨╜╨╜╤Л╨╝╨╕ ╨▓╨╗╨╛╨╢╨╡╨╜╨╕╤П╨╝╨╕
            // ╨Я╤А╨╕╨╝╨╡╤З╨░╨╜╨╕╨╡: ╨▓ ╨╕╤Б╤В╨╛╤А╨╕╨╕ ╤Б╨╛╤Е╤А╨░╨╜╤П╨╡╨╝ ╤В╨╛╨╗╤М╨║╨╛ ╨╛╤В╨┐╤А╨░╨▓╨╗╨╡╨╜╨╜╤Л╨╣ ╤В╨╡╨║╤Б╤В, ╨▒╨╡╨╖ ╨┐╨╛╨╗╨╜╨╛╨╣ ╨╕╤Б╤В╨╛╤А╨╕╨╕
            await storage.addSupplierMessage({
              requestSupplierId: requestSupplier.id,
              content: content,
              direction: 'outbound', // ╨╛╤В╨┐╤А╨░╨▓╨╗╨╡╨╜╨╛ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╨╡╨╝ ╤Б╨╕╤Б╤В╨╡╨╝╤Л, ╨╜╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨╝
              sentDate: new Date(),
              attachments: sanitizedAttachments // Use sanitized attachments here too
            });

            console.log(`Saved reply message to conversation history for supplier ${requestSupplier.id}`);
          } else {
            console.warn(`Could not find request supplier mapping for requestId=${response.requestId}, email=${response.supplierEmail}`);
          }

          res.json({ success: true, message: "Reply sent successfully" });
        } else {
          res.status(500).json({ success: false, message: "Failed to send reply" });
        }
      } catch (emailError) {
        console.error("Error sending reply email:", emailError);
        res.status(500).json({ success: false, message: "Error sending email", error: String(emailError) });
      }
    } catch (error) {
      console.error("Error processing reply:", error);
      res.status(500).json({ success: false, message: "Failed to process reply", error: String(error) });
    }
  });

  // ╨Ь╨░╤А╤И╤А╤Г╤В ╨┤╨╗╤П ╨│╨╡╨╜╨╡╤А╨░╤Ж╨╕╨╕ ╤Б╤А╨░╨▓╨╜╨╕╤В╨╡╨╗╤М╨╜╨╛╨│╨╛ ╨░╨╜╨░╨╗╨╕╨╖╨░ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓
  // ╨Ф╨╛╤Б╤В╤Г╨┐╨╡╨╜ ╤В╨╛╨╗╤М╨║╨╛ ╨░╤Г╤В╨╡╨╜╤В╨╕╤Д╨╕╤Ж╨╕╤А╨╛╨▓╨░╨╜╨╜╤Л╨╝ ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤П╨╝
  app.post("/api/generate-comparison", tokenAuthMiddleware, requireAuth, (req, res, next) => {
    console.log('Authenticated request to /api/generate-comparison by user ' + (req.user ? req.user.username : 'unknown') + ' (' + (req.user ? req.user.id : 'unknown') + ')');
    console.log('[Auth] Request auth details:', {
      hasSession: !!req.session,
      sessionID: req.sessionID,
      authenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      authType: (req as any).authType || 'unknown',
      cookies: req.headers.cookie ? 'present' : 'missing',
      token: req.headers.authorization ? 'present' : 'missing'
    });
    next();
  }, handleFixedCompareRequest);

  // ╨Ь╨░╤А╤И╤А╤Г╤В╤Л ╨┤╨╗╤П ╨┤╨╛╤Б╤В╤Г╨┐╨░ ╨║ ╨▓╨╗╨╛╨╢╨╡╨╜╨╕╤П╨╝ ╤Д╨░╨╣╨╗╨╛╨▓
  app.get("/api/attachments/:responseId/:attachmentIndex/download", requireAuth, downloadAttachment);
  app.get("/api/attachments/:responseId/:attachmentIndex", requireAuth, downloadAttachment);
  // Only define supplier message attachments route once, with proper auth middleware from supplier-message-attachments.ts
  app.get("/api/supplier-message-attachments/:messageId/:attachmentIndex", 
    (req, res, next) => {
      console.log('[routes] Processing supplier message attachment request with proper auth');
      // Use our custom auth middleware from supplier-message-attachments.ts
      const { requireAuth } = require('./routes/supplier-message-attachments');
      requireAuth(req, res, next);
    }, 
    downloadSupplierMessageAttachment);

  // ╨Ь╨░╤А╤И╤А╤Г╤В ╨┤╨╗╤П ╨╛╤В╨┐╤А╨░╨▓╨║╨╕ ╨╖╨░╨┐╤А╨╛╤Б╨░ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╤Г
  app.post("/api/supplier-follow-up", requireAuth, sendFollowUp);

  // AI Analysis endpoint
  app.post("/api/generate-analysis", requireAuth, async (req, res) => {
    try {
      const { suppliers, parameters, requestId } = req.body;
      const userId = req.user?.id;

      console.log(`[ANALYSIS] Starting analysis for ${suppliers?.length || 0} suppliers with ${parameters?.length || 0} parameters`);

      if (!suppliers || suppliers.length === 0) {
        return res.status(400).json({ error: 'No suppliers provided for analysis' });
      }

      if (!parameters || parameters.length === 0) {
        return res.status(400).json({ error: 'No parameters provided for analysis' });
      }

      // Get supplier responses for analysis
      let supplierResponses = await storage.getSupplierResponses(requestId || null, userId);

      if (supplierResponses.length === 0 && userId) {
        supplierResponses = await storage.getSupplierResponses(requestId || null);
      }

      if (supplierResponses.length === 0) {
        return res.status(404).json({ error: 'No supplier responses found' });
      }

      // Build table data for analysis
      const tableData: Record<string, any>[] = [];
      const supplierDetails: any[] = [];

      // Process each supplier  
      for (const supplier of suppliers) {
        // Get all responses for this supplier filtered by request ID
        const allResponses = await storage.getSupplierResponses(requestId || null, userId);
        const supplierResponses = allResponses.filter(response => 
          response.supplierEmail === supplier.email || 
          response.supplierName === supplier.name
        );

        if (supplierResponses.length > 0) {
          const latestResponse = supplierResponses[0];

          supplierDetails.push({
            id: supplier.id,
            name: supplier.name,
            email: supplier.email,
            responseCount: supplierResponses.length
          });

          // Get extracted parameters for this supplier
          const extractedParamsData = await storage.getExtractedParametersByResponseId(latestResponse.id);

          parameters.forEach((paramName: string) => {
            let existingRow = tableData.find(row => row.Parameter === paramName);
            if (!existingRow) {
              existingRow = { Parameter: paramName };
              tableData.push(existingRow);
            }

            let paramValue = '-';
            if (extractedParamsData && extractedParamsData.parameters) {
              let parsedParams = extractedParamsData.parameters;

              if (typeof parsedParams === 'string') {
                try {
                  parsedParams = JSON.parse(parsedParams);
                } catch (e) {
                  console.error(`Error parsing parameters for response ${latestResponse.id}:`, e);
                }
              }

              if (parsedParams && typeof parsedParams === 'object' && (parsedParams as any)[paramName]) {
                paramValue = String((parsedParams as any)[paramName]).trim();
                if (paramValue === '' || paramValue === 'null' || paramValue === 'undefined') {
                  paramValue = '-';
                }
              }
            }

            existingRow[supplier.name] = paramValue;
          });
        }
      }

      // Generate AI analysis using DeepSeek
      const { generateComparisonAnalysis } = await import('./services/deepseek-api.js');

      const aiAnalysis = await generateComparisonAnalysis(
        supplierDetails,
        tableData,
        parameters,
        requestId
      );

      console.log(`[ANALYSIS] Generated AI analysis successfully`);

      res.json({
        success: true,
        analysis: aiAnalysis,
        supplierCount: suppliers.length,
        parameterCount: parameters.length
      });

    } catch (error) {
      console.error('Error generating analysis:', error);
      res.status(500).json({ 
        error: 'Failed to generate analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // API ╨╝╨░╤А╤И╤А╤Г╤В╤Л ╨┤╨╗╤П ╨░╨╜╨░╨╗╨╕╨╖╨░ ╤А╨╡╨╖╤Г╨╗╤М╤В╨░╤В╨╛╨▓
  // ╨б╨╛╨╖╨┤╨░╨╜╨╕╨╡ ╨╜╨╛╨▓╨╛╨│╨╛ ╨░╨╜╨░╨╗╨╕╨╖╨░ ╤А╨╡╨╖╤Г╨╗╤М╤В╨░╤В╨╛╨▓
  app.post("/api/analysis-results", requireAuth, async (req, res) => {
    try {
      const result = insertAnalysisResultSchema.parse(req.body);

      // Always set userId from the authenticated user
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ 
          message: "Unauthorized: User ID not found in session", 
          error: "Missing user ID" 
        });
      }

      // Set the userId in the result data
      result.userId = userId;
      console.log(`[routes] Creating analysis result with explicit userId=${userId} for requestId=${result.requestId}`);

      const newResult = await storage.createAnalysisResult(result);
      res.status(201).json(newResult);
    } catch (error) {
      console.error("Error creating analysis result:", error);
      res.status(400).json({ 
        message: "Failed to create analysis result", 
        error: String(error) 
      });
    }
  });

  // ╨Я╨╛╨╗╤Г╤З╨╡╨╜╨╕╨╡ ╨▓╤Б╨╡╤Е ╨░╨╜╨░╨╗╨╕╨╖╨╛╨▓ ╤А╨╡╨╖╤Г╨╗╤М╤В╨░╤В╨╛╨▓ ╨┤╨╗╤П ╨║╨╛╨╜╨║╤А╨╡╤В╨╜╨╛╨│╨╛ ╨╖╨░╨┐╤А╨╛╤Б╨░
  app.get("/api/analysis-results/request/:requestId", requireAuth, async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      if (isNaN(requestId)) {
        return res.status(400).json({ message: "Invalid request ID format" });
      }
      const results = await storage.getAnalysisResults(requestId);
      res.json(results);
    } catch (error) {
      console.error(`Error fetching analysis results for request ID ${req.params.requestId}:`, error);
      res.status(500).json({ 
        message: "Failed to fetch analysis results", 
        error: String(error) 
      });
    }
  });

  // ╨Я╨╛╨╗╤Г╤З╨╡╨╜╨╕╨╡ ╨║╨╛╨╜╨║╤А╨╡╤В╨╜╨╛╨│╨╛ ╨░╨╜╨░╨╗╨╕╨╖╨░ ╤А╨╡╨╖╤Г╨╗╤М╤В╨░╤В╨╛╨▓ ╨┐╨╛ ID
  app.get("/api/analysis-results/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid analysis result ID format" });
      }
      const result = await storage.getAnalysisResultById(id);
      if (!result) {
        return res.status(404).json({ message: `Analysis result with ID ${id} not found` });
      }
      res.json(result);
    } catch (error) {
      console.error(`Error fetching analysis result with ID ${req.params.id}:`, error);
      res.status(500).json({ 
        message: "Failed to fetch analysis result", 
        error: String(error) 
      });
    }
  });

  // API routes for improvement request tracking (Fixed version using storage method)
  app.get('/api/improvement-requests/counts', requireAuth, async (req, res) => {
    try {
      const { requestId } = req.query;
      if (!requestId) {
        return res.status(400).json({ error: 'Request ID is required' });
      }

      console.log(`[routes] Getting improvement request counts for request ${requestId}`);
      
      // Get counts from our fixed storage method
      const counts = await storage.getImprovementRequestCounts(parseInt(requestId as string));

      console.log(`[routes] Returning counts:`, counts);
      
      res.json({ 
        success: true, 
        counts 
      });
    } catch (error) {
      console.error('Error getting improvement request counts:', error);
      res.status(500).json({ 
        error: 'Failed to get improvement request counts',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  app.post("/api/improvement-requests", saveImprovementRequest);

  // API ╨┤╨╗╤П ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╣ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓
  app.post("/api/request-suppliers/:id/add-message", requireAuth, addSupplierMessage);
  app.get("/api/request-suppliers/:id/messages", requireAuth, getSupplierMessages);

  // Register supplier attachment analysis routes
  app.use(supplierAttachmentRoutes);
  app.use('/api/extract-parameters', extractParametersRoutes);
  app.use('/api/parameters', parameterRoutes);
  app.use('/api/analysis-results', requireAuth, analysisResultsRoutes);

  // PUT endpoint for updating extracted parameters (client compatibility)
  app.put("/api/extracted-parameters/:responseId", requireAuth, async (req: Request, res: Response) => {
    try {
      const responseId = parseInt(req.params.responseId);
      const { parameters } = req.body;

      if (isNaN(responseId)) {
        return res.status(400).json({ error: 'Invalid response ID' });
      }

      if (!parameters || typeof parameters !== 'object') {
        return res.status(400).json({ error: 'Parameters object is required' });
      }

      // Get the user ID from the authenticated request for multi-tenant isolation
      const userId = req.user && (req.user as any).id ? (req.user as any).id : null;

      console.log(`[PUT /api/extracted-parameters/${responseId}] Updating extracted parameters for responseId=${responseId}, userId=${userId}`);
      console.log(`[PUT /api/extracted-parameters/${responseId}] Parameters to update:`, parameters);

      // First, get the existing parameters to ensure they exist
      const existingParams = await storage.getExtractedParametersByResponseId(responseId, userId);

      if (!existingParams) {
        console.log(`[PUT /api/extracted-parameters/${responseId}] No existing parameters found, creating new ones`);

        // Get response info to extract requestId and supplierEmail
        const response = await storage.getSupplierResponseById(responseId);
        if (!response) {
          return res.status(404).json({ 
            error: 'Response not found',
            message: 'The specified response does not exist'
          });
        }

        // Create new parameters if none exist
        const insertData = {
          responseId: responseId,
          userId: userId || 0,
          requestId: response.requestId,
          supplierEmail: response.supplierEmail,
          parameters: parameters,
          status: 'manually_corrected',
          extractionDate: new Date(),
          lastUpdateDate: new Date()
        };
        try {
          await storage.saveExtractedParameters(insertData);
        } catch (error) {
          console.error('Error creating parameters:', error);
          return res.status(500).json({ 
            error: 'Failed to create parameters',
            message: 'Database creation failed'
          });
        }
      } else {
        console.log(`[PUT /api/extracted-parameters/${responseId}] Found existing parameters, updating them`);
        // Update the parameters using storage method
        const success = await storage.updateExtractedParameters(responseId, userId, parameters);

        if (!success) {
          return res.status(500).json({ 
            error: 'Failed to update parameters',
            message: 'Database update failed'
          });
        }
      }

      console.log(`[PUT /api/extracted-parameters/${responseId}] Successfully saved/updated parameters`);

      return res.status(200).json({
        success: true,
        message: 'Parameters updated successfully',
        parameters: parameters,
        responseId: responseId
      });

    } catch (error) {
      console.error(`[PUT /api/extracted-parameters] Error updating extracted parameters:`, error);
      return res.status(500).json({
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Download supplier attachment by filename (public route to allow direct browser downloads)
  app.get("/api/attachments/:requestId/:responseId/:filename", downloadSupplierAttachment);

  // NOTE: We've already registered supplier-message-attachments with proper authentication above

  // Analysis projects routes
  app.use('/api/analyze', analysisProjectsRoutes);
  app.use('/api/analysis-projects', analysisProjectsRoutes);
  app.use('/api/analysis-integration', analysisIntegrationRoutes);
  app.use('/api/analysis-requests', analysisRequestsRoutes);
  app.use('/api/semantic', semanticVectorizationRoutes);

  // Subscription routes - registered after authentication is set up
  app.use('/api/subscriptions', subscriptionRoutes);
  console.log('[Server] Registered subscription routes at /api/subscriptions');

  // Register admin email routes
  console.log('[Server] Registered admin email routes');
  app.use(adminEmailRoutes);
  // Register admin moderation routes
  console.log('[Server] Registered admin moderation routes');
  app.use('/api/admin', adminModerationRoutes);
  // Register admin excluded domains routes
  console.log('[Server] Registered admin excluded domains routes');
  app.use('/api/admin', adminExcludedDomainsRoutes);
  // Register admin client requests routes
  console.log('[Server] Registered admin client requests routes');
  app.use('/api/admin', adminClientRequestsRoutes);
  // Register admin unprocessed emails routes
  console.log('[Server] Registered admin unprocessed emails routes');
  app.use('/api/admin', adminUnprocessedEmailsRoutes);
  // Register admin moderation test routes (NO AUTH - FOR TESTING ONLY)
  console.log('[Server] Registered admin moderation test routes');
  app.use('/api/admin-test', adminModerationTestRoutes);
  // Simple test endpoint for staging suppliers (NO AUTH)
  app.get("/api/test/staging-suppliers", async (req, res) => {
    try {
      console.log('[Test] Fetching staging suppliers...');
      
      const stagingRecords = await db
        .select()
        .from(stagingSuppliers)
        .where(eq(stagingSuppliers.status, 'new'))
        .orderBy(stagingSuppliers.createdAt);

      console.log(`[Test] Found ${stagingRecords.length} records`);

      res.json({
        success: true,
        data: stagingRecords,
        total: stagingRecords.length
      });

    } catch (error) {
      console.error('[Test] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // User mode preference API endpoints
  app.get("/api/user/mode", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "╨Э╨╡ ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "╨Я╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤М ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜" });
      }

      res.json({ 
        mode: user.preferredMode || 'supplier_search' 
      });
    } catch (error) {
      console.error('Error getting user mode:', error);
      res.status(500).json({ error: "╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╡╤А╨▓╨╡╤А╨░" });
    }
  });

  app.post("/api/user/mode", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "╨Э╨╡ ╨░╨▓╤В╨╛╤А╨╕╨╖╨╛╨▓╨░╨╜" });
      }

      const { mode } = req.body;
      if (!mode || !['supplier_search', 'analyze_offers'].includes(mode)) {
        return res.status(400).json({ error: "╨Э╨╡╨▓╨╡╤А╨╜╤Л╨╣ ╤А╨╡╨╢╨╕╨╝" });
      }

      await db.update(users)
        .set({ preferredMode: mode })
        .where(eq(users.id, userId));

      res.json({ success: true, mode });
    } catch (error) {
      console.error('Error saving user mode:', error);
      res.status(500).json({ error: "╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╡╤А╨▓╨╡╤А╨░" });
    }
  });

  // Register supplier search routes
  app.use("/api/supplier-search", supplierSearchRoutes);
  console.log('[Server] Registered unified supplier search routes at /api/supplier-search');
  
  // Register universal search routes
  app.use('/api/universal-search', universalSearchRoutes);
  console.log('[Server] Registered universal search routes at /api/universal-search');

  // Subscription routes now registered early in index.ts

  // Batch endpoint for getting supplier responses for multiple requests
  app.get('/api/supplier-responses-batch', requireAuth, async (req, res) => {
    try {
      const requestIdsParam = req.query.requestIds as string;
      const userId = req.user?.id;

      if (!requestIdsParam) {
        return res.status(400).json({ error: 'requestIds parameter is required' });
      }

      const requestIds = JSON.parse(requestIdsParam) as number[];
      const responses = await storage.getAllSupplierResponsesForRequestsOptimized(requestIds, userId);

      res.json(responses);
    } catch (error) {
      console.error('Error fetching batch supplier responses:', error);
      res.status(500).json({ error: 'Failed to fetch supplier responses' });
    }
  });

  // Endpoint ╨┤╨╗╤П ╨╖╨░╨│╤А╤Г╨╖╨║╨╕ ╨▓╨╗╨╛╨╢╨╡╨╜╨╕╨╣ ╨┐╨╛ ╤В╤А╨╡╨▒╨╛╨▓╨░╨╜╨╕╤О
  app.get("/api/attachments/:responseId/:filename", requireAuth, async (req, res) => {
    try {
      const { responseId, filename } = req.params;
      const userId = req.user?.id;

      const response = await storage.getSupplierResponseById(parseInt(responseId));
      
      if (!response || response.userId !== userId) {
        return res.status(404).json({ error: 'Attachment not found' });
      }

      const attachment = (response.attachments as any[]).find((att: any) => att.filename === filename);
      
      if (!attachment || !attachment.content) {
        return res.status(404).json({ error: 'Attachment content not found' });
      }

      res.setHeader('Content-Type', attachment.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(attachment.content, 'base64'));
    } catch (error) {
      console.error('Error fetching attachment:', error);
      res.status(500).json({ error: 'Failed to fetch attachment' });
    }
  });

  // Improvement request count endpoint
  app.get("/api/improvement-requests/count/:requestId", requireAuth, async (req, res) => {
    try {
      const requestId = parseInt(req.params.requestId);
      if (isNaN(requestId)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }

      const userId = req.user?.id;
      const count = await storage.getImprovementRequestCount(requestId, userId);

      res.json({ count });
    } catch (error) {
      console.error('Error fetching improvement request count:', error);
      res.status(500).json({ error: 'Failed to fetch improvement request count' });
    }
  });

  // Get attachment metadata for a response
  app.get("/api/supplier-responses/:responseId/attachments", requireAuth, async (req, res) => {
    try {
      const responseId = parseInt(req.params.responseId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log(`[Server] Fetching attachments for response ${responseId} by user ${userId}`);

      const attachments = await storage.getSupplierResponseAttachments(responseId, userId);
      
      res.json(attachments);
    } catch (error) {
      console.error(`Error fetching attachments for response ${req.params.responseId}:`, error);
      res.status(500).json({ message: "Failed to fetch attachments", error: String(error) });
    }
  });

  // Alternative download endpoint with index-based access
  app.get("/api/attachments/:responseId/:attachmentIndex/download", requireAuth, async (req, res) => {
    try {
      const { responseId, attachmentIndex } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const index = parseInt(attachmentIndex);
      if (isNaN(index)) {
        return res.status(400).json({ message: "Invalid attachment index" });
      }

      console.log(`[Server] Fetching attachment at index ${index} for response ${responseId} by user ${userId}`);

      // Get all attachments for this response
      const attachments = await storage.getSupplierResponseAttachments(parseInt(responseId), userId);
      
      if (!attachments || attachments.length === 0) {
        return res.status(404).json({ message: "No attachments found" });
      }

      if (index < 0 || index >= attachments.length) {
        return res.status(404).json({ message: "Attachment index out of range" });
      }

      const attachment = attachments[index];
      
      // Get the full content
      const attachmentData = await storage.getSupplierResponseAttachmentContent(
        parseInt(responseId), 
        attachment.filename, 
        userId
      );

      if (!attachmentData) {
        return res.status(404).json({ message: "Attachment content not found" });
      }

      // Set appropriate headers for file download
      res.setHeader('Content-Type', attachmentData.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
      res.setHeader('Content-Length', Buffer.from(attachmentData.content, 'base64').length);

      // Send the file content
      res.send(Buffer.from(attachmentData.content, 'base64'));
      
      console.log(`[Server] Successfully served attachment "${attachment.filename}" for response ${responseId}`);
    } catch (error) {
      console.error(`Error fetching attachment at index ${req.params.attachmentIndex} for response ${req.params.responseId}:`, error);
      res.status(500).json({ message: "Failed to fetch attachment", error: String(error) });
    }
  });

  // Get full attachment content for download
  app.get("/api/attachments/:responseId/:filename", requireAuth, async (req, res) => {
    try {
      const { responseId, filename } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Decode the filename properly
      const decodedFilename = decodeURIComponent(filename);
      console.log(`[Server] Fetching attachment "${decodedFilename}" for response ${responseId} by user ${userId}`);

      // Get the attachment content
      const attachmentData = await storage.getSupplierResponseAttachmentContent(
        parseInt(responseId), 
        decodedFilename, 
        userId
      );

      if (!attachmentData) {
        console.log(`[Server] Attachment not found: "${decodedFilename}" for response ${responseId}`);
        return res.status(404).json({ message: "Attachment not found or access denied" });
      }

      // Set appropriate headers for file download
      res.setHeader('Content-Type', attachmentData.contentType);
      
      // Fix filename encoding for Content-Disposition header
      // Clean filename to avoid invalid characters but preserve original name
      const cleanFilename = decodedFilename.replace(/[<>:"/\\|?*]/g, '_');
      const encodedFilename = encodeURIComponent(cleanFilename);
      res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"; filename*=UTF-8''${encodedFilename}`);
      res.setHeader('Content-Length', Buffer.from(attachmentData.content, 'base64').length);

      // Send the file content
      res.send(Buffer.from(attachmentData.content, 'base64'));
      
      console.log(`[Server] Successfully served attachment "${decodedFilename}" for response ${responseId}`);
    } catch (error) {
      console.error(`Error fetching attachment ${req.params.filename} for response ${req.params.responseId}:`, error);
      res.status(500).json({ message: "Failed to fetch attachment", error: String(error) });
    }
  });

  // Batch processing of attachments for all unprocessed responses
  app.post("/api/supplier-responses/batch-process-attachments", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log(`[Server] Batch processing attachments for user ${userId}`);

      // Get all responses with attachments that haven't been processed
      const unprocessedResponses = await storage.getUnprocessedSupplierResponses(userId);
      
      if (unprocessedResponses.length === 0) {
        return res.json({ 
          message: 'No unprocessed responses found',
          processedCount: 0
        });
      }

      console.log(`[Server] Found ${unprocessedResponses.length} unprocessed responses`);

      // Process each response
      const results = [];
      for (const response of unprocessedResponses) {
        try {
          console.log(`[Server] Processing response ${response.id} with ${response.attachments?.length || 0} attachments`);
          
          // Get the full response with attachments
          const fullResponse = await storage.getSupplierResponseWithAttachments(response.id, userId);
          if (!fullResponse) {
            console.log(`[Server] Response ${response.id} not found or access denied`);
            continue;
          }

          // Process attachments using unified service
          const attachments = fullResponse.attachments || [];
          if (attachments.length > 0) {
            try {
              const processedAttachments = await attachmentProcessor.processAttachments(attachments, {
                timeout: 60000, // 60 seconds
              });
              
              // Update the response with processed attachments
              await storage.updateSupplierResponseAttachments(response.id, processedAttachments);
              console.log(`[Server] Successfully processed ${processedAttachments.length} attachments for response ${response.id}`);
              results.push({ responseId: response.id, status: 'success', processedCount: processedAttachments.length });
            } catch (error) {
              console.error(`[Server] Error processing attachments for response ${response.id}:`, error);
              results.push({ responseId: response.id, status: 'processing_error', error: error instanceof Error ? error.message : String(error) });
            }
          } else {
            results.push({ responseId: response.id, status: 'no_attachments', processedCount: 0 });
          }

        } catch (error) {
          console.error(`Error processing response ${response.id}:`, error);
          results.push({ responseId: response.id, status: 'error', error: String(error) });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const totalProcessed = results.reduce((sum, r) => sum + (r.processedCount || 0), 0);

      res.json({ 
        message: 'Batch processing completed',
        totalResponses: unprocessedResponses.length,
        successCount,
        totalProcessed,
        results
      });

    } catch (error) {
      console.error(`Error in batch processing:`, error);
      res.status(500).json({ message: "Failed to process attachments", error: String(error) });
    }
  });

  // Manual processing of attachments for a response
  app.post("/api/supplier-responses/:id/process-attachments", requireAuth, async (req, res) => {
    try {
      const responseId = parseInt(req.params.id);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log(`[Server] Manual processing of attachments for response ${responseId} by user ${userId}`);

      // Check if response exists and belongs to user
      const response = await storage.getSupplierResponseById(responseId);
      if (!response || response.userId !== userId) {
        return res.status(404).json({ message: "Response not found or access denied" });
      }

      // Get the full response with attachments
      const fullResponse = await storage.getSupplierResponseWithAttachments(responseId, userId);
      if (!fullResponse) {
        return res.status(404).json({ message: "Response with attachments not found" });
      }

      // Process attachments using unified service
      const attachments = fullResponse.attachments || [];
      if (attachments.length > 0) {
        try {
          const processedAttachments = await attachmentProcessor.processAttachments(attachments, {
            timeout: 60000, // 60 seconds
          });
          
          // Update the response with processed attachments
          await storage.updateSupplierResponseAttachments(responseId, processedAttachments);
          console.log(`[Server] Successfully processed ${processedAttachments.length} attachments for response ${responseId}`);
          
          res.json({ 
            message: 'Attachments processed successfully',
            responseId: responseId,
            processedCount: processedAttachments.length
          });
        } catch (error) {
          console.error(`[Server] Error processing attachments for response ${responseId}:`, error);
          res.status(500).json({ 
            message: "Failed to process attachments", 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      } else {
        res.json({ 
          message: 'No attachments to process',
          responseId: responseId,
          processedCount: 0
        });
      }

    } catch (error) {
      console.error(`Error processing attachments for response ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to process attachments", error: String(error) });
    }
  });

  // ╨а╨╡╨│╨╕╤Б╤В╤А╨╕╤А╤Г╨╡╨╝ routes ╨┤╨╗╤П ╤Г╨┐╤А╨░╨▓╨╗╨╡╨╜╨╕╤П ╤Б╨╕╤Б╤В╨╡╨╝╨╛╨╣ ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╨╕ ╨▓╨╗╨╛╨╢╨╡╨╜╨╕╨╣
  registerAttachmentManagementRoutes(app);

  const httpServer = createServer(app);

  return httpServer;
}
