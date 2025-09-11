import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { emailService, sendEmail } from "./email";
import { ImapService } from "./imap-service";
import { personalImapService } from "./imap-service-personal";
import 'express-session';

// Расширяем типы для Session, чтобы добавить поддержку userId
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    passport?: any;
  }
}
// Создаем экземпляр IMAP-сервиса
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
import { SearchRequest, InsertSearchRequest, Supplier, SupplierMatch, RequestSupplier } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ - перехватываем ВСЕ POST запросы
  app.use((req, res, next) => {
    if (req.method === 'POST' && req.path.includes('send-email')) {
      console.log("🔥 КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ POST:", req.method, req.path);
      console.log("🔥 Body suppliers:", req.body?.suppliers);
      console.log("🔥 Body suppliers length:", req.body?.suppliers?.length);
    }
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


  // Get batch of supplier responses for multiple requests (GET метод с параметрами в URL)
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
      const allResponses = await storage.getAllSupplierResponsesForRequests(requestIds, userId);

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

  // POST метод для пакетной загрузки ответов поставщиков (данные в теле запроса)
  app.post("/api/supplier-responses-batch", requireAuth, async (req, res) => {
    try {
      // Set cache control header to prevent caching
      res.set('Cache-Control', 'no-store');

      const { requestIds } = req.body;
      if (!Array.isArray(requestIds) || requestIds.length === 0) {
        return res.status(400).json({ message: "Invalid request: requestIds must be a non-empty array" });
      }

      // Преобразуем строковые ID в числовые, если нужно
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

      // Группируем ответы по ID запроса
      const responsesByRequestId: Record<string, any[]> = {};

      // Инициализируем пустые массивы для каждого ID запроса
      validIds.forEach(id => {
        responsesByRequestId[id] = [];
      });

      // Распределяем ответы по соответствующим запросам
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

      return res.json(response);
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
        return res.status(400).json({ message: "Неверный формат ID" });
      }

      const response = await storage.toggleFavoriteResponse(id);
      if (!response) {
        return res.status(404).json({ message: `Ответ с ID ${id} не найден` });
      }

      res.json({
        success: true,
        isFavorite: response.isFavorite,
        message: response.isFavorite ? "Добавлено в избранное" : "Удалено из избранного",
        response
      });
    } catch (error) {
      console.error(`Ошибка при изменении статуса избранного для ответа ${req.params.id}:`, error);
      res.status(500).json({ 
        message: "Не удалось изменить статус избранного", 
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
        // Если userId не установлен и не в режиме SKIP_AUTH, значит у нас проблема с сессией
        console.log('[Server] WARNING: userId not set for authenticated request!', req.user);
        // Получаем информацию о сессии для отладки
        console.log('[Server] Session info:', req.session);
        return res.status(401).json({ error: 'Не удалось получить ID пользователя из сессии. Пожалуйста, попробуйте войти заново.' });
      }

      // Check subscription status (but don't increment counter for search requests)
      if (userId && process.env.SKIP_AUTH !== 'true') {
        const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(userId);
        if (!subscriptionStatus.isActive) {
          console.log(`[search-requests] User ${userId} subscription is not active: ${subscriptionStatus.message}`);
          return res.status(403).json({ 
            error: 'Подписка неактивна', 
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
            ? `Найдено всего ${totalFound}, в пробной версии доступны максимум первые 10 поставщиков`
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
          error: 'Подписка неактивна', 
          message: subscriptionStatus.message 
        });
      }

      // Increment the request count
      const countIncremented = await subscriptionService.incrementRequestCount(userId);
      if (!countIncremented) {
        console.error(`[send-email] Failed to increment request count for user ${userId}`);
        return res.status(500).json({ 
          error: 'Ошибка учета использования' 
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
          productName: subject || 'Прямой запрос',
          productDescription: 'Создано через форму прямого запроса',
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
            const fallbackParams = ['Общая стоимость без НДС', 'Сроки поставки'];
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
      
      // Проверим, пришли ли ID из групп контактов (не поставщиков)
      const isFromContactGroup = req.body.fromContactGroup === true;
      
      // Handle both database suppliers (positive IDs) and API suppliers (negative IDs)
      let selectedSuppliers = [];

      if (isFromContactGroup) {
        // Получаем контакты из групп по ID
        const contactIds = supplierIds.filter(id => typeof id === 'number' || (typeof id === 'string' && !id.startsWith('api-')));
        console.log("Contact group IDs:", contactIds);
        
        // Получаем детали для всех контактов
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
        // Стандартная обработка поставщиков
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

            // Преобразуем содержимое в формат, подходящий для nodemailer
            // Оставляем base64 строку как есть, не преобразуем в Buffer,
            // но добавляем индикатор encoding: 'base64' в объект вложения
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

            console.log(`🔧 Fixed supplier ID: ${supplier.id} → ${fixedSupplierId}`);

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
            // Remove the REQ- prefix if it already exists in orderNumber to avoid duplication
            const requestRef = (searchRequest.orderNumber || searchRequest.id).toString();
            const cleanRequestRef = requestRef.startsWith('REQ-') ? requestRef : `REQ-${requestRef}`;
            const formattedSubject = `${subject} - [${cleanRequestRef}] [TID:${trackingId}]`;

            // Add reference footer to message for tracking
            const referenceFooter = `\n\n!Request Reference: ${cleanRequestRef}\nRequest Tracking ID: ${trackingId}\nPlease include this reference in your reply to ensure proper tracking of your response.`;

            const fullMessage = message + referenceFooter;

            // Сохранение первого сообщения в истории с userId
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
              console.log(`Сохранено первое исходящее сообщение для requestSupplierId=${requestSupplier.id} в истории сообщений`);
            } catch (msgError) {
              console.error(`Ошибка при сохранении исходящего сообщения в истории: ${msgError}`);
            }

            // Send the email with tracking information, sanitized attachments and business card
            const emailSuccess = await sendEmail(
              supplier.email, 
              formattedSubject, 
              fullMessage,
              {
                html: fullMessage.replace(/\n/g, '<br/>'),
                attachments: sanitizedAttachments,
                trackingId: trackingId,
                requestId: searchRequest.id, // Используем ID запроса как дополнительный идентификатор
                userId: userId // Добавляем ID пользователя для включения бизнес-карточки
              }
            );

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

      // Добавляем подробный лог об успешности
      console.log(`Email execution summary: ${successCount} of ${selectedSuppliers.length} emails sent successfully.`);

      // Note: Request count is incremented at the beginning of this endpoint, 
      // not here at the end, to ensure consistency regardless of email success/failure

      // Формируем детальный ответ со всей информацией, необходимой клиенту
      res.json({ 
        success: successCount > 0, 
        totalCount: selectedSuppliers.length,
        successCount,
        orderNumber: searchRequest.orderNumber,
        requestId: searchRequest.id,
        // Дополнительно фильтруем results, чтобы не передавать слишком много данных
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

      // Add userId to filter by user's own data
      const request = await storage.getSearchRequest(id, userId);
      if (!request) {
        return res.status(404).json({ message: `Request with ID ${id} not found or access denied` });
      }

      // Get all suppliers contacted for this request (filtered by userId)
      const requestSuppliers = await storage.getRequestSuppliers(id, userId);

      // Get all responses for this request (filtered by userId)
      const supplierResponses = await storage.getSupplierResponses(id, userId);

      res.json({
        request,
        requestSuppliers,
        supplierResponses
      });
    } catch (error) {
      console.error(`Error fetching request ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to fetch request details", error: String(error) });
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

  // API эндпоинты для работы с группами контактов

  // Получение всех групп контактов
  app.get("/api/contact-groups", requireAuth, async (req, res) => {
    try {
      // Получаем ID пользователя из объекта req.user (установленного middleware)
      const userId = req.user?.id;

      if (!userId) {
        console.error("[Server] User ID not found in authenticated request");
        return res.status(401).json({ error: "Пользователь не авторизован или сессия истекла" });
      }

      console.log(`[Server] Fetching contact groups for user ID: ${userId}`);

      // SECURITY: Always filter by userId - even admins should only see their own groups
      // This prevents cross-user data contamination
      const groups = await storage.getContactGroups(userId);
      console.log(`[Server] Filtered to ${groups.length} groups belonging to user ${userId}`);

      // ОПТИМИЗАЦИЯ: Получаем количество контактов одним запросом для всех групп
      if (groups.length > 0) {
        try {
          const groupIds = groups.map(group => group.id);
          const contactCounts = await storage.getContactCountsByGroupIds(groupIds, userId);
          
          // Обновляем contactCount для каждой группы
          groups.forEach(group => {
            group.contactCount = contactCounts[group.id] || 0;
          });
        } catch (err) {
          console.error("Ошибка получения количества контактов для групп:", err);
          // В случае ошибки оставляем исходные значения contactCount
        }
      }

      res.json(groups);
    } catch (error) {
      console.error("Ошибка получения групп контактов:", error);
      res.status(500).json({ message: "Не удалось получить группы контактов", error: String(error) });
    }
  });

  // Создание новой группы контактов
  app.post("/api/contact-groups", requireAuth, async (req, res) => {
    try {
      // Получаем ID пользователя из объекта req.user (установленного middleware)
      const userId = req.user?.id;

      if (!userId) {
        console.error("[Server] User ID not found in authenticated request");
        return res.status(401).json({ error: "Пользователь не авторизован или сессия истекла" });
      }

      console.log(`[Server] Creating new contact group for user ID: ${userId}`);

      const validatedData = insertContactGroupSchema.parse(req.body);

      // Всегда добавляем userId текущего пользователя
      validatedData.userId = userId;

      const newGroup = await storage.createContactGroup(validatedData);
      res.status(201).json(newGroup);
    } catch (error) {
      console.error("Ошибка создания группы контактов:", error);
      res.status(400).json({ message: "Не удалось создать группу контактов", error: String(error) });
    }
  });

  // Получение конкретной группы контактов по ID с контактами
  app.get("/api/contact-groups/:id", requireAuth, async (req, res) => {
    // Устанавливаем заголовки, запрещающие кэширование
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Некорректный формат ID" });
      }

      // Добавляем проверку доступа - группа должна принадлежать пользователю
      const userId = req.user?.id;
      console.log(`Checking access to contact group ${id} for user ${userId}`);

      const group = await storage.getContactGroupById(id, userId);
      if (!group) {
        return res.status(404).json({ message: `Группа контактов с ID ${id} не найдена или недоступна` });
      }

      // Получить контакты для группы с учетом userId для изоляции данных
      const contacts = await storage.getContactItemsByGroupId(id, userId);
      console.log(`Найдено ${contacts.length} контактов для группы ${id} пользователя ${userId}`);

      // Вернуть объект с группой и контактами
      res.json({
        group,
        contacts
      });
    } catch (error) {
      console.error(`Ошибка получения группы контактов с ID ${req.params.id}:`, error);
      res.status(500).json({ message: "Не удалось получить группу контактов", error: String(error) });
    }
  });

  // Получение контактов для конкретной группы
  app.get("/api/contact-groups/:groupId/contacts", requireAuth, async (req, res) => {
    // Устанавливаем заголовок JSON и запрещаем кэширование
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
      const groupId = parseInt(req.params.groupId);
      console.log(`Запрос контактов для группы ${groupId}`);

      if (isNaN(groupId)) {
        console.error(`Некорректный ID группы: ${req.params.groupId}`);
        return res.status(400).json([]);  // Возвращаем пустой массив вместо ошибки
      }

      // Проверяем, принадлежит ли группа текущему пользователю
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Не авторизован" });
      }

      // Получаем информацию о группе с проверкой владельца
      const group = await storage.getContactGroupById(groupId, userId);
      if (!group) {
        return res.status(404).json({ error: "Группа не найдена" });
      }

      const contacts = await storage.getContactItemsByGroupId(groupId, userId);
      console.log(`Найдено ${contacts.length} контактов для группы ${groupId} пользователя ${userId}`);

      res.json(contacts);
    } catch (error) {
      console.error(`Ошибка получения контактов для группы ${req.params.groupId}:`, error);
      // В случае ошибки возвращаем пустой массив, а не ошибку
      res.status(200).json([]);
    }
  });

  // Добавление контактов в группу
  app.post("/api/contact-groups/:groupId/add-contacts", requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      console.log(`Добавление контактов в группу ${groupId}`);

      if (isNaN(groupId)) {
        console.error(`Некорректный ID группы: ${req.params.groupId}`);
        return res.status(400).json({ message: "Неверный формат ID группы" });
      }

      const { contacts } = req.body;

      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ message: "Контакты должны быть представлены массивом" });
      }

      console.log(`Попытка добавить ${contacts.length} контактов в группу ${groupId}`);

      // Проверяем существование группы
      const userId = req.user?.id;
      const group = await storage.getContactGroupById(groupId, userId);
      if (!group) {
        return res.status(404).json({ message: "Группа не найдена" });
      }

      // Получаем существующие контакты для проверки дубликатов
      const existingContacts = await storage.getContactItemsByGroupId(groupId, userId);
      const existingEmails = new Set();

      // Собираем все существующие email в нижнем регистре для более точного сравнения
      existingContacts.forEach(contact => {
        if (contact.email) {
          existingEmails.add(contact.email.toLowerCase().trim());
        }
      });

      console.log(`В группе ${groupId} найдено ${existingContacts.length} существующих контактов`);
      console.log(`Существующие email: ${Array.from(existingEmails).join(', ')}`);

      // Фильтруем только уникальные контакты, проверяя email после приведения к нижнему регистру
      const uniqueContacts = contacts.filter(contact => {
        if (!contact.email) return true; // Контакты без email всегда добавляем
        const normalizedEmail = contact.email.toLowerCase().trim();
        const isDuplicate = existingEmails.has(normalizedEmail);
        console.log(`Проверяем контакт: ${contact.name} <${normalizedEmail}>`);
        console.log(`Существующие emails в группе: [${Array.from(existingEmails).join(', ')}]`);
        console.log(`Это дубликат? ${isDuplicate}`);
        
        if (isDuplicate) {
          console.log(`Обнаружен дубликат email: ${normalizedEmail}`);
        }
        return !isDuplicate;
      });

      console.log(`Отфильтровано ${uniqueContacts.length} из ${contacts.length} контактов для добавления`);

      if (uniqueContacts.length === 0) {
        return res.status(200).json({ 
          message: "Нет новых контактов для добавления", 
          added: 0 
        });
      }

      // Перед добавлением контактов, убедимся что у каждого добавляемого контакта будет userId
      const contactsWithUserId = uniqueContacts.map(contact => ({
        ...contact,
        userId: userId, // Важно: это обеспечивает изоляцию данных между разными пользователями
        groupId: groupId // Убедимся, что groupId тоже установлен правильно
      }));

      console.log(`Добавление ${contactsWithUserId.length} контактов с userId=${userId} в группу ${groupId}`);

      // Добавляем контакты в группу с userId для изоляции данных
      const result = await storage.addContactsToGroup(groupId, contactsWithUserId, userId);

      res.status(200).json({ 
        message: `Добавлено ${result.length} контактов в группу ${groupId}`,
        added: result.length,
        contacts: result
      });

    } catch (error) {
      console.error(`Ошибка добавления контактов в группу ${req.params.groupId}:`, error);
      res.status(500).json({ message: "Ошибка добавления контактов в группу" });
    }
  });

  // Обновление группы контактов по ID
  app.put("/api/contact-groups/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Некорректный формат ID" });
      }

      const validatedData = insertContactGroupSchema.parse(req.body);
      const updatedGroup = await storage.updateContactGroup(id, validatedData);

      if (!updatedGroup) {
        return res.status(404).json({ message: `Группа контактов с ID ${id} не найдена` });
      }

      console.log(`Группа контактов с ID ${id} успешно обновлена`);
      res.json(updatedGroup);
    } catch (error) {
      console.error(`Ошибка обновления группы контактов ${req.params.id}:`, error);
      res.status(400).json({ message: "Не удалось обновить группу контактов", error: String(error) });
    }
  });

  // Удаление группы контактов по ID
  app.post("/api/contact-groups/:id/delete", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Некорректный формат ID" });
      }

      // Проверяем существование группы
      const userId = req.user?.id;
      const group = await storage.getContactGroupById(id, userId);
      if (!group) {
        return res.status(404).json({ success: false, message: `Группа контактов с ID ${id} не найдена` });
      }

      // Удаляем группу
      const success = await storage.deleteContactGroup(id);

      if (success) {
        console.log(`Группа контактов с ID ${id} успешно удалена`);
        res.json({ success: true, message: `Группа контактов "${group.name}" успешно удалена` });
      } else {
        console.error(`Не удалось удалить группу контактов с ID ${id}`);
        res.status(500).json({ success: false, message: "Не удалось удалить группу контактов" });
      }
    } catch (error) {
      console.error(`Ошибка при удалении группы контактов с ID ${req.params.id}:`, error);
      res.status(500).json({ success: false, message: "Ошибка при удалении группы контактов", error: String(error) });
    }
  });

  // Отправка email по группе контактов
  app.post("/api/contact-groups/send-email", requireAuth, async (req, res) => {
    try {
      const { groupId, subject, message, contactIds = [], attachments = [] } = req.body;

      if (!groupId || !subject || !message) {
        return res.status(400).json({ error: "Отсутствуют обязательные поля" });
      }

      // Validate that we have at least one contact
      if (!contactIds.length) {
        return res.status(400).json({ error: "Не выбрано ни одного контакта" });
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
          console.error(`Ошибка получения контакта с ID ${contactId}:`, err);
        }
      }

      console.log(`Выбрано ${selectedContacts.length} контактов для отправки`);

      if (selectedContacts.length === 0) {
        return res.status(400).json({ error: "Не найдено контактов для отправки" });
      }

      // Send email to all selected contacts using our API
      const supplierIds = selectedContacts.map(contact => contact.id);
      const payload = {
        suppliers: supplierIds,
        subject: subject,
        message: message,
        requestId: 0, // Временный запрос
        attachments: attachments || [],
        fromContactGroup: true // Важный флаг: эти ID из групп контактов
      };

      // Отправляем на наш собственный API endpoint
      // Это позволяет переиспользовать всю логику отправки
      const sendResponse = await new Promise((resolve) => {
        // Изменяем тип параметров для обработчика, чтобы он принимал частичные объекты
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

        // Создаем виртуальный запрос к /api/send-email
        // Создаем объект с базовыми свойствами, затем расширяем его из req,
        // затем переопределяем нужные свойства для виртуального запроса
        // Создаем объект запроса с только необходимыми свойствами
        const mockReq = Object.assign({}, req, {
          method: 'POST',
          url: '/api/send-email',
          body: payload,
          headers: Object.assign({}, req.headers, {
            'content-type': 'application/json'
          })
        });

        // Создаем объект ответа с необходимым минимумом свойств
        // TypeScript не строг к дополнительным свойствам при присваивании, поэтому избегаем ошибок компиляции
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
      console.error("Ошибка отправки email для группы контактов:", error);
      res.status(500).json({ error: String(error), message: "Не удалось отправить email" });
    }
  });

  // Add a supplier to a contact group
  app.post("/api/supplier-contact-groups", requireAuth, async (req, res) => {
    try {
      const validatedData = insertRequestSupplierGroupSchema.parse(req.body);

      console.log("Добавление поставщика в группу контактов:", validatedData);

      // Получаем данные поставщика
      const requestSupplier = await storage.getRequestSupplierById(validatedData.requestSupplierId);
      if (!requestSupplier) {
        return res.status(404).json({ message: "Поставщик не найден" });
      }

      // Получаем существующие контакты для проверки дубликатов email
      const existingContacts = await storage.getContactItemsByGroupId(validatedData.contactGroupId);
      const existingEmails = new Set(existingContacts.map(contact => 
        contact.email?.toLowerCase() || ''
      ));

      // Проверяем, есть ли уже контакт с таким email в группе
      if (requestSupplier.supplierEmail && existingEmails.has(requestSupplier.supplierEmail.toLowerCase())) {
        return res.status(409).json({ 
          message: "Контакт с таким email уже существует в этой группе", 
          duplicate: true 
        });
      }

      // Если дубликатов нет, добавляем поставщика в группу
      const newRelation = await storage.addSupplierToContactGroup(validatedData);

      console.log("Поставщик добавлен в группу контактов:", newRelation);

      res.status(201).json(newRelation);
    } catch (error) {
      console.error("Error adding supplier to contact group:", error);
      res.status(400).json({ message: "Failed to add supplier to contact group", error: String(error) });
    }
  });

  // Создание нового контактного элемента для группы
  app.post("/api/contact-items", requireAuth, async (req, res) => {
    try {
      // Убедимся, что у нас есть все необходимые поля
      const validatedData = insertContactItemSchema.parse(req.body);

      console.log("Создание нового контакта:", validatedData);

      // Получаем ID пользователя из токена
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Не авторизован" });
      }

      // Проверяем, принадлежит ли группа текущему пользователю
      const groupId = validatedData.groupId;
      const group = await storage.getContactGroupById(groupId, userId);

      if (!group) {
        return res.status(404).json({ error: "Группа не найдена" });
      }

      // Проверяем, что группа принадлежит текущему пользователю
      if (group.userId !== userId) {
        console.warn(`Попытка добавить контакт в чужую группу: Пользователь ${userId} пытается добавить контакт в группу ${groupId} пользователя ${group.userId}`);
        return res.status(403).json({ error: "Нет доступа к этой группе" });
      }

      // Используем метод storage вместо прямого запроса в базу данных
      // Передаем userId для изоляции данных
      const existingContacts = await storage.getContactItemsByEmail(validatedData.groupId, validatedData.email, userId);

      // Если контакт уже существует, возвращаем информацию о дубликате
      if (existingContacts && existingContacts.length > 0) {
        console.log(`Контакт с email ${validatedData.email} уже существует в группе ${validatedData.groupId}`);
        return res.status(200).json({ 
          duplicate: true, 
          id: existingContacts[0].id,
          email: validatedData.email 
        });
      }

      // Создаем новый контакт и добавляем userId для изоляции данных
      const contactWithUserId = {
        ...validatedData,
        userId: userId // Добавляем user ID для правильной изоляции между аккаунтами
      };
      const newContact = await storage.createContactItem(contactWithUserId);

      console.log("Новый контакт создан:", newContact);

      res.status(201).json(newContact);
    } catch (error) {
      console.error("Ошибка создания контакта:", error);
      res.status(400).json({ message: "Не удалось создать контакт", error: String(error) });
    }
  });

  // Маршрут для обновления контакта
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

  // Маршрут для удаления контакта
  app.delete("/api/contact-items/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      // Получаем ID пользователя из токена
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Не авторизован" });
      }

      // Сначала получаем контакт, чтобы узнать его группу
      const contact = await storage.getContactById(id);
      if (!contact) {
        return res.status(404).json({ message: `Контакт с ID ${id} не найден` });
      }

      // Получаем информацию о группе
      const groupId = contact.groupId;
      const group = await storage.getContactGroupById(groupId, userId);

      if (!group) {
        return res.status(404).json({ error: "Группа контакта не найдена" });
      }

      // Проверяем, что группа принадлежит текущему пользователю
      if (group.userId !== userId) {
        console.warn(`Попытка удалить контакт из чужой группы: Пользователь ${userId} пытается удалить контакт ${id} из группы ${groupId} пользователя ${group.userId}`);
        return res.status(403).json({ error: "Нет доступа к этой группе" });
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
    console.log("\n🔍 PERSONAL EMAIL CHECK REQUEST RECEIVED");
    console.log("User:", req.user?.username, "ID:", req.user?.id);
    console.log("Timestamp:", new Date().toISOString());

    const requestId = req.body.requestId;
    console.log("Request ID from client:", requestId);
    
    // Get user's email configuration for debugging
    try {
      const userEmailConfig = await storage.getUserEmailConfig(req.user.id);
      console.log(`\n📧 USER EMAIL CONFIG FOR ID ${req.user.id}:`);
      console.log("- Email Account:", userEmailConfig?.emailAccount || "NOT SET");
      console.log("- Email Configured:", userEmailConfig?.emailConfigured || false);
      console.log("- Has Password:", !!userEmailConfig?.emailPassword);
      console.log("- IMAP Host:", userEmailConfig?.imapHost || "imap.mail.ru");
      console.log("- IMAP Port:", userEmailConfig?.imapPort || 993);
    } catch (configError) {
      console.error("❌ Error getting user email config:", configError);
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

  // API эндпоинт для обновления групп контактов для поставщика
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

  // Маршрут для отправки ответов поставщикам
  app.post("/api/supplier-responses/:id/reply", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        console.log("User ID missing in authenticated request");
        return res.status(401).json({ error: "Не авторизован" });
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
        return res.status(403).json({ error: "У вас нет доступа к этому запросу" });
      }

      // Enhanced sanitization of attachments for replies
      let sanitizedAttachments: {
        filename: string;
        contentType: string;
        content: string;
        encoding?: string;
        size?: number;
      }[] = [];

      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        console.log(`Reply includes ${attachments.length} attachments`);

        // Process each attachment to ensure it has valid content
        sanitizedAttachments = attachments.map(attachment => {
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
        }).filter(attachment => attachment.content && attachment.content.length > 0);

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
          emailContent += `\n\n-------------------------\nОригинальное сообщение от ${response.supplierName || response.supplierEmail} (${responseDate.toLocaleString('ru-RU')}):\n\n${response.content}`;
        }

        // Add request details if available
        if (request.productName) {
          emailContent += `\n\n-------------------------\nЗапрос: ${request.productName}`;
          if (request.productDescription) {
            emailContent += `\nОписание: ${request.productDescription}`;
          }
        }

        // Получаем ID пользователя, отправляющего ответ
        const userId = req.user?.id || 1; // Используем 1 как ID по умолчанию в режиме разработки

        const success = await sendEmail(
          response.supplierEmail,
          subject,
          emailContent,
          {
            attachments: sanitizedAttachments, // Use sanitized attachments instead of raw ones
            userId: userId, // Добавляем ID пользователя для включения бизнес-карточки
            requestId: response.requestId, // Добавляем requestId 
            replyTo: response.supplierEmail // Используем email как replyTo
          }
        );

        if (success) {
          // Update the response as replied to
          await storage.updateSupplierResponse(id, { isRepliedTo: true });

          // Найдем requestSupplierId для этого поставщика и запроса
          const requestSupplier = await storage.getRequestSupplierByRequestAndEmail(
            response.requestId, 
            response.supplierEmail
          );

          if (requestSupplier) {
            // Сохраняем сообщение в истории переписки с санитизированными вложениями
            // Примечание: в истории сохраняем только отправленный текст, без полной истории
            await storage.addSupplierMessage({
              requestSupplierId: requestSupplier.id,
              content: content,
              direction: 'outbound', // отправлено пользователем системы, не поставщиком
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

  // Маршрут для генерации сравнительного анализа поставщиков
  // Доступен только аутентифицированным пользователям
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

  // Маршруты для доступа к вложениям файлов
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

  // Маршрут для отправки запроса поставщику
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

  // API маршруты для анализа результатов
  // Создание нового анализа результатов
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

  // Получение всех анализов результатов для конкретного запроса
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

  // Получение конкретного анализа результатов по ID
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

  // API для сообщений поставщиков
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

  // User mode preference API endpoints
  app.get("/api/user/mode", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Не авторизован" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      res.json({ 
        mode: user.preferredMode || 'supplier_search' 
      });
    } catch (error) {
      console.error('Error getting user mode:', error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.post("/api/user/mode", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Не авторизован" });
      }

      const { mode } = req.body;
      if (!mode || !['supplier_search', 'analyze_offers'].includes(mode)) {
        return res.status(400).json({ error: "Неверный режим" });
      }

      await db.update(users)
        .set({ preferredMode: mode })
        .where(eq(users.id, userId));

      res.json({ success: true, mode });
    } catch (error) {
      console.error('Error saving user mode:', error);
      res.status(500).json({ error: "Ошибка сервера" });
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
      const responses = await storage.getAllSupplierResponsesForRequests(requestIds, userId);

      res.json(responses);
    } catch (error) {
      console.error('Error fetching batch supplier responses:', error);
      res.status(500).json({ error: 'Failed to fetch supplier responses' });
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

  const httpServer = createServer(app);

  return httpServer;
}