import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { db } from '../db';
import { storage } from '../storage';
import { 
  searchRequests, 
  users, 
  stagingSuppliers, 
  requestSuppliers, 
  suppliers, 
  supplierResponses 
} from '@shared/schema';
import { eq, sql, and, desc, count, leftJoin, gte, lte, isNull } from 'drizzle-orm';

const router = Router();

// Middleware to verify admin access
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    console.log('[Admin Client Requests API] requireAdmin middleware called');
    console.log('[Admin Client Requests API] req.user:', req.user);
    console.log('[Admin Client Requests API] req.headers.authorization:', req.headers.authorization);
    
    let userRole = (req.user as any)?.role;
    let userId = (req.user as any)?.id;
    
    // If user data is incomplete, try to fetch from database
    if (userId && !userRole) {
      console.log('[Admin Client Requests API] User role missing, fetching from database...');
      try {
        const user = await storage.getUserById(userId);
        if (user) {
          userRole = user.role;
          req.user.role = user.role;
          req.user.username = user.username;
          console.log('[Admin Client Requests API] User data loaded from DB:', { id: user.id, username: user.username, role: user.role });
        }
      } catch (dbError) {
        console.log('[Admin Client Requests API] Error fetching user from database:', dbError);
      }
    }
    
    const isAdmin = userRole === 'admin' || userId === 1; // User ID 1 is considered admin
    
    console.log('[Admin Client Requests API] User role:', userRole, 'User ID:', userId, 'Is admin:', isAdmin);
    
    if (!isAdmin) {
      console.log('[Admin Client Requests API] Access denied: User is not an admin');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can access this resource'
      });
    }
    
    console.log('[Admin Client Requests API] Admin access granted');
    next();
  } catch (error) {
    console.error('[Admin Client Requests API] Error in admin verification:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify admin privileges'
    });
  }
};

// GET /api/admin/clients - список клиентов с количеством запросов
router.get('/clients', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Admin Clients API] Fetching clients list');

    // Add anti-caching headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Parse query parameters for pagination and filtering
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const searchTerm = req.query.search as string;

    console.log('[Admin Clients API] Filter params:', { startDate, endDate, searchTerm, page, limit });

    // Build WHERE conditions for search_requests
    let searchRequestConditions = [];

    if (startDate) {
      const startDateObj = new Date(startDate);
      startDateObj.setUTCHours(0, 0, 0, 0);
      searchRequestConditions.push(sql`${searchRequests.createdAt} >= ${startDateObj}`);
    }

    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setUTCHours(23, 59, 59, 999);
      searchRequestConditions.push(sql`${searchRequests.createdAt} <= ${endDateObj}`);
    }

    const searchRequestWhereClause = searchRequestConditions.length > 0 ? and(...searchRequestConditions) : undefined;

    // Get clients with their request counts
    const clientsQuery = await db
      .select({
        userId: users.id,
        userName: users.username,
        userEmail: users.username, // username is email in this system
        requestCount: sql<number>`COUNT(${searchRequests.id})`,
        lastRequestDate: sql<string>`MAX(${searchRequests.createdAt})`
      })
      .from(users)
      .leftJoin(searchRequests, eq(users.id, searchRequests.userId))
      .where(searchRequestWhereClause || undefined) // Apply conditions to searchRequests
      .groupBy(users.id, users.username)
      .orderBy(desc(sql`COUNT(${searchRequests.id})`));

    // Apply search filter if provided
    let filteredClients = clientsQuery;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredClients = clientsQuery.filter(client =>
        (client.userName && client.userName.toLowerCase().includes(searchLower)) ||
        (client.userEmail && client.userEmail.toLowerCase().includes(searchLower))
      );
    }

    // Get total count for pagination
    const totalCount = filteredClients.length;

    // Apply pagination
    const paginatedClients = filteredClients.slice(offset, offset + limit);

    console.log(`[Admin Clients API] Found ${totalCount} clients, returning ${paginatedClients.length}`);
    console.log(`[Admin Clients API] Sample clients:`, paginatedClients.slice(0, 3));

    const response = {
      clients: paginatedClients,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };

    console.log(`[Admin Clients API] Response:`, response);
    res.status(200).json(response);
  } catch (error) {
    console.error('[Admin Clients API] Error fetching clients:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch clients'
    });
  }
});

// GET /api/admin/clients/:userId/requests - запросы конкретного клиента
router.get('/clients/:userId/requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    console.log(`[Admin Client Requests API] Fetching requests for client ${userId}`);

    // Add anti-caching headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Parse query parameters for pagination and filtering
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    console.log('[Admin Client Requests API] Filter params:', { startDate, endDate, page, limit });

    // Build WHERE conditions
    let whereConditions = [eq(searchRequests.userId, userId)];

    if (startDate) {
      const startDateObj = new Date(startDate);
      startDateObj.setUTCHours(0, 0, 0, 0);
      whereConditions.push(sql`${searchRequests.createdAt} >= ${startDateObj}`);
    }

    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setUTCHours(23, 59, 59, 999);
      whereConditions.push(sql`${searchRequests.createdAt} <= ${endDateObj}`);
    }

    const whereClause = and(...whereConditions);

    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: count() })
      .from(searchRequests)
      .where(whereClause);

    const totalCount = totalCountResult[0]?.count || 0;
    console.log('[Admin Client Requests API] Total count:', totalCount);

    // Get requests
    const requests = await db
      .select({
        id: searchRequests.id,
        userId: searchRequests.userId,
        orderNumber: searchRequests.orderNumber,
        searchSessionId: searchRequests.searchSessionId,
        productName: searchRequests.productName,
        productDescription: searchRequests.productDescription,
        additionalRequirements: searchRequests.additionalRequirements,
        timeline: searchRequests.timeline,
        status: searchRequests.status,
        createdAt: searchRequests.createdAt,
        userName: users.username,
        userEmail: users.username,
      })
      .from(searchRequests)
      .leftJoin(users, eq(searchRequests.userId, users.id))
      .where(whereClause)
      .orderBy(desc(searchRequests.createdAt))
      .limit(limit)
      .offset(offset);

    console.log('[Admin Client Requests API] Found requests:', requests.length);

    // For each request, get counts using requestId
    const requestsWithCounts = await Promise.all(
      requests.map(async (request) => {
        // Count results using requestId (new approach)
        const resultsCountResult = await db
          .select({ count: sql`COUNT(DISTINCT ${stagingSuppliers.rawTitle})` })
          .from(stagingSuppliers)
          .where(eq(stagingSuppliers.requestId, request.id));

        const resultsCount = resultsCountResult[0]?.count || 0;

        // Count sent requests
        const sentRequestsCountResult = await db
          .select({ count: count() })
          .from(requestSuppliers)
          .where(eq(requestSuppliers.requestId, request.id));

        const sentRequestsCount = sentRequestsCountResult[0]?.count || 0;

        // Count responses
        const responsesCountResult = await db
          .select({ count: count() })
          .from(supplierResponses)
          .where(eq(supplierResponses.requestId, request.id));

        const responsesCount = responsesCountResult[0]?.count || 0;

        // Check if there's a winner (placeholder - isWinner field doesn't exist yet)
        // TODO: Add isWinner field to requestSuppliers table
        const hasWinner = false;

        // Определяем правильный поисковый запрос
        let queryText = request.productName || 'Не указано';
        
        // Если есть результаты поиска, попробуем получить запрос из staging_suppliers
        if (resultsCount > 0) {
          const requestSearchQueryResult = await db
            .select({ searchQuery: stagingSuppliers.searchQuery })
            .from(stagingSuppliers)
            .where(eq(stagingSuppliers.requestId, request.id))
            .limit(1);
          
          if (requestSearchQueryResult.length > 0 && requestSearchQueryResult[0].searchQuery) {
            queryText = requestSearchQueryResult[0].searchQuery;
          }
        }
        
        // Фильтруем очевидно плохие данные
        if (queryText === 'Не указано' || queryText === 'Запросфывафыва' || queryText.length < 3) {
          queryText = 'Поисковый запрос не найден';
        }
        
        // Обрезаем если слишком длинный
        if (queryText.length > 60) {
          queryText = queryText.substring(0, 60) + '...';
        }

        return {
          ...request,
          query: queryText, // Добавляем обработанный поисковый запрос
          resultsCount,
          sentRequestsCount,
          responsesCount,
          hasWinner
        };
      })
    );

    const response = {
      requests: requestsWithCounts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };

    console.log(`[Admin Client Requests API] Response:`, response);
    res.status(200).json(response);
  } catch (error) {
    console.error('[Admin Client Requests API] Error fetching client requests:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch client requests'
    });
  }
});

// GET /api/admin/client-requests - список заказов клиентов с поисковыми запросами
router.get('/client-requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Admin Client Requests API] Fetching client requests with search queries');
    console.log('[Admin Client Requests API] req.user in main handler:', req.user);
    
    // Add anti-caching headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Parse query parameters for pagination and filtering
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    
    console.log('[Admin Client Requests API] Filter params:', { startDate, endDate, page, limit });
    console.log('[Admin Client Requests API] Raw query params:', req.query);
    
    // Build WHERE conditions for search_requests
    let whereConditions = [];
    
    if (startDate) {
      // Convert to start of day in UTC
      const startDateObj = new Date(startDate);
      startDateObj.setUTCHours(0, 0, 0, 0);
      console.log('[Admin Client Requests API] Start date filter:', startDateObj);
      whereConditions.push(sql`${searchRequests.createdAt} >= ${startDateObj}`);
    }
    
    if (endDate) {
      // Convert to end of day in UTC
      const endDateObj = new Date(endDate);
      endDateObj.setUTCHours(23, 59, 59, 999);
      console.log('[Admin Client Requests API] End date filter:', endDateObj);
      whereConditions.push(sql`${searchRequests.createdAt} <= ${endDateObj}`);
    }
    
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    
    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: count() })
      .from(searchRequests)
      .where(whereClause);
    
    const totalCount = totalCountResult[0]?.count || 0;
    console.log('[Admin Client Requests API] Total count:', totalCount);
    
    // Get requests with user info
    const requests = await db
      .select({
        id: searchRequests.id,
        userId: searchRequests.userId,
        orderNumber: searchRequests.orderNumber,
        searchSessionId: searchRequests.searchSessionId,
        productName: searchRequests.productName,
        productDescription: searchRequests.productDescription,
        additionalRequirements: searchRequests.additionalRequirements,
        timeline: searchRequests.timeline,
        status: searchRequests.status,
        createdAt: searchRequests.createdAt,
        userName: users.username,
        userEmail: users.username, // username is email in this system
      })
      .from(searchRequests)
      .leftJoin(users, eq(searchRequests.userId, users.id))
      .where(whereClause)
      .orderBy(desc(searchRequests.createdAt))
      .limit(limit)
      .offset(offset);
    
    console.log('[Admin Client Requests API] Found requests:', requests.length);
    if (requests.length > 0) {
      console.log('[Admin Client Requests API] Sample request dates:', requests.slice(0, 3).map(r => ({ 
        id: r.id, 
        createdAt: r.createdAt, 
        productName: r.productName,
        searchSessionId: r.searchSessionId 
      })));
    }
    
    // For each request, get results count and sent requests count
    const requestsWithCounts = await Promise.all(
      requests.map(async (request) => {
        // Count unique companies from staging_suppliers for this request using searchSessionId
        let resultsCount = 0;
        let searchQuery = request.productName;
        
        // Use requestId for precise matching (new approach)
        const resultsCountResult = await db
          .select({ count: sql`COUNT(DISTINCT ${stagingSuppliers.rawTitle})` })
          .from(stagingSuppliers)
          .where(eq(stagingSuppliers.requestId, request.id));
        
        resultsCount = resultsCountResult[0]?.count || 0;
        
        // Get the search query from staging_suppliers for this request
        const searchQueryResult = await db
          .select({ searchQuery: stagingSuppliers.searchQuery })
          .from(stagingSuppliers)
          .where(eq(stagingSuppliers.requestId, request.id))
          .limit(1);
        
        if (searchQueryResult.length > 0) {
          searchQuery = searchQueryResult[0].searchQuery;
        }
        
        // Fallback to searchSessionId if no results found with requestId
        if (resultsCount === 0 && request.searchSessionId) {
          const fallbackResultsCountResult = await db
            .select({ count: sql`COUNT(DISTINCT ${stagingSuppliers.rawTitle})` })
            .from(stagingSuppliers)
            .where(eq(stagingSuppliers.searchSessionId, request.searchSessionId));
          
          resultsCount = fallbackResultsCountResult[0]?.count || 0;
          
          // Get search query from fallback
          if (resultsCount > 0) {
            const fallbackSearchQueryResult = await db
              .select({ searchQuery: stagingSuppliers.searchQuery })
              .from(stagingSuppliers)
              .where(eq(stagingSuppliers.searchSessionId, request.searchSessionId))
              .limit(1);
            
            if (fallbackSearchQueryResult.length > 0) {
              searchQuery = fallbackSearchQueryResult[0].searchQuery;
            }
          }
        }
        
        // Final fallback to time-based matching for very old records
        if (resultsCount === 0) {
          const timeRange = new Date(request.createdAt);
          timeRange.setMinutes(timeRange.getMinutes() - 30);
          const timeRangeEnd = new Date(request.createdAt);
          timeRangeEnd.setMinutes(timeRangeEnd.getMinutes() + 30);
          
          const timeBasedResultsCountResult = await db
            .select({ count: sql`COUNT(DISTINCT ${stagingSuppliers.rawTitle})` })
            .from(stagingSuppliers)
            .where(
              and(
                eq(stagingSuppliers.userId, request.userId),
                gte(stagingSuppliers.createdAt, timeRange),
                lte(stagingSuppliers.createdAt, timeRangeEnd)
              )
            );
          
          resultsCount = timeBasedResultsCountResult[0]?.count || 0;
        }
        
        // Count sent requests from request_suppliers
        const sentRequestsCountResult = await db
          .select({ count: count() })
          .from(requestSuppliers)
          .where(eq(requestSuppliers.requestId, request.id));
        
        const sentRequestsCount = sentRequestsCountResult[0]?.count || 0;
        
        // Try to find the actual search query from staging_suppliers
        // Look for staging suppliers that match this request's user and product name
        const legacySearchQueryResult = await db
          .select({ searchQuery: stagingSuppliers.searchQuery })
          .from(stagingSuppliers)
          .where(
            and(
              eq(stagingSuppliers.userId, request.userId),
              eq(stagingSuppliers.searchQuery, request.productName)
            )
          )
          .limit(1);
        
        console.log(`[Admin Client Requests API] Request ${request.id}: productName="${request.productName}", found searchQuery:`, legacySearchQueryResult);
        
        let queryText = '';
        if (legacySearchQueryResult.length > 0 && legacySearchQueryResult[0].searchQuery) {
          // Use the actual search query from staging_suppliers
          queryText = legacySearchQueryResult[0].searchQuery;
          console.log(`[Admin Client Requests API] Request ${request.id}: Using searchQuery="${queryText}"`);
        } else {
          // If no exact match found, try to find search queries for this user around the same time
          const timeRange = new Date(request.createdAt);
          timeRange.setMinutes(timeRange.getMinutes() - 30); // 30 minutes before
          const timeRangeEnd = new Date(request.createdAt);
          timeRangeEnd.setMinutes(timeRangeEnd.getMinutes() + 30); // 30 minutes after
          
          const userSearchQuery = await db
            .select({ searchQuery: stagingSuppliers.searchQuery })
            .from(stagingSuppliers)
            .where(
              and(
                eq(stagingSuppliers.userId, request.userId),
                gte(stagingSuppliers.createdAt, timeRange),
                lte(stagingSuppliers.createdAt, timeRangeEnd)
              )
            )
            .orderBy(desc(stagingSuppliers.createdAt))
            .limit(1);
          
          if (userSearchQuery.length > 0) {
            queryText = userSearchQuery[0].searchQuery;
            console.log(`[Admin Client Requests API] Request ${request.id}: Using time-based searchQuery="${queryText}"`);
          } else {
            // Check if there are any staging_suppliers records for this searchSessionId
            if (request.searchSessionId) {
              const sessionRecords = await db
                .select({ count: sql`COUNT(*)` })
                .from(stagingSuppliers)
                .where(eq(stagingSuppliers.searchSessionId, request.searchSessionId));
              
              const sessionCount = sessionRecords[0]?.count || 0;
              
              if (sessionCount > 0) {
                queryText = 'Поиск выполнен, но запрос не определен';
                console.log(`[Admin Client Requests API] Request ${request.id}: Search performed but query not determined (${sessionCount} results)`);
              } else {
                queryText = 'Поиск не выполнялся';
                console.log(`[Admin Client Requests API] Request ${request.id}: No search performed`);
              }
            } else {
              queryText = 'Поисковый запрос не найден';
              console.log(`[Admin Client Requests API] Request ${request.id}: No search query found`);
            }
          }
        }
        
        // Filter out obviously bad data - but only if we have a real search query
        if (queryText !== 'Поисковый запрос не найден' && 
            queryText !== 'Поиск выполнен, но запрос не определен' &&
            queryText !== 'Поиск не выполнялся' &&
            (queryText === 'Не указано' || queryText === 'Запросфывафыва' || queryText.length < 3)) {
          queryText = 'Поисковый запрос не найден';
        }
        
        // Truncate if too long
        if (queryText.length > 60) {
          queryText = queryText.substring(0, 60) + '...';
        }
        
        return {
          id: request.id,
          userName: request.userName || 'Unknown',
          userEmail: request.userEmail || 'Unknown',
          query: queryText,
          createdAt: request.createdAt,
          searchSessionId: request.searchSessionId || null,
          resultsCount,
          sentRequestsCount
        };
      })
    );
    
    // No aggressive deduplication - show all requests as they are unique by time
    console.log(`[Admin Client Requests API] Found ${requestsWithCounts.length} requests`);
    
    const response = {
      requests: requestsWithCounts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('[Admin Client Requests API] Error fetching client requests:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch client requests'
    });
  }
});

// GET /api/admin/client-requests/:id/results - детализация результатов
router.get('/client-requests/:id/results', requireAuth, requireAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    console.log(`[Admin Client Requests API] Fetching results for request ${requestId}`);
    
    // Add anti-caching headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Get the request to find the user and time
    const request = await db
      .select({
        userId: searchRequests.userId,
        productName: searchRequests.productName,
        productDescription: searchRequests.productDescription,
        createdAt: searchRequests.createdAt
      })
      .from(searchRequests)
      .where(eq(searchRequests.id, requestId))
      .limit(1);
    
    if (!request.length) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Request not found'
      });
    }
    
    // Find the actual search query from staging_suppliers for this request
    const timeRange = new Date(request[0].createdAt);
    timeRange.setMinutes(timeRange.getMinutes() - 30); // 30 minutes before
    const timeRangeEnd = new Date(request[0].createdAt);
    timeRangeEnd.setMinutes(timeRangeEnd.getMinutes() + 30); // 30 minutes after
    
    // First try to find exact match
    let searchQuery = request[0].productName;
    const exactMatch = await db
      .select({ searchQuery: stagingSuppliers.searchQuery })
      .from(stagingSuppliers)
      .where(
        and(
          eq(stagingSuppliers.userId, request[0].userId),
          eq(stagingSuppliers.searchQuery, request[0].productName)
        )
      )
      .limit(1);
    
    if (exactMatch.length > 0) {
      searchQuery = exactMatch[0].searchQuery;
    } else {
      // Try to find search query in time range
      const timeBasedMatch = await db
        .select({ searchQuery: stagingSuppliers.searchQuery })
        .from(stagingSuppliers)
        .where(
          and(
            eq(stagingSuppliers.userId, request[0].userId),
            gte(stagingSuppliers.createdAt, timeRange),
            lte(stagingSuppliers.createdAt, timeRangeEnd)
          )
        )
        .orderBy(desc(stagingSuppliers.createdAt))
        .limit(1);
      
      if (timeBasedMatch.length > 0) {
        searchQuery = timeBasedMatch[0].searchQuery;
      }
    }
    
    console.log(`[Admin Client Requests API] Fetching results for request ${requestId} using requestId filter`);
    
    // Get all staging suppliers for this request ID
    const results = await db
      .select({
        id: stagingSuppliers.id,
        sourceEngine: stagingSuppliers.sourceEngine,
        searchQuery: stagingSuppliers.searchQuery,
        region: stagingSuppliers.region,
        rawTitle: stagingSuppliers.rawTitle,
        rawDescription: stagingSuppliers.rawDescription,
        rawUrl: stagingSuppliers.rawUrl,
        rawEmails: stagingSuppliers.rawEmails,
        rawPhones: stagingSuppliers.rawPhones,
        status: stagingSuppliers.status,
        createdAt: stagingSuppliers.createdAt
      })
      .from(stagingSuppliers)
      .where(eq(stagingSuppliers.requestId, requestId))
      .orderBy(desc(stagingSuppliers.createdAt));
    
    console.log(`[Admin Client Requests API] Found ${results.length} results for request ${requestId}`);
    
    res.status(200).json({
      requestId,
      searchQuery: searchQuery,
      results
    });
  } catch (error) {
    console.error('[Admin Client Requests API] Error fetching request results:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch request results'
    });
  }
});

// GET /api/admin/client-requests/:id/sent-requests - детализация отправленных запросов
router.get('/client-requests/:id/sent-requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    console.log(`[Admin Client Requests API] Fetching sent requests for request ${requestId}`);
    
    // Add anti-caching headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Get all sent requests for this request ID
    const sentRequests = await db
      .select({
        id: requestSuppliers.id,
        supplierId: requestSuppliers.supplierId,
        supplierName: requestSuppliers.supplierName,
        supplierEmail: requestSuppliers.supplierEmail,
        supplierWebsite: requestSuppliers.supplierWebsite,
        supplierPhone: requestSuppliers.supplierPhone,
        trackingId: requestSuppliers.trackingId,
        sentAt: requestSuppliers.sentAt,
        emailSubject: requestSuppliers.emailSubject,
        hasResponded: requestSuppliers.hasResponded
      })
      .from(requestSuppliers)
      .where(eq(requestSuppliers.requestId, requestId))
      .orderBy(desc(requestSuppliers.sentAt));
    
    // For each sent request, check if there's a response
    const sentRequestsWithResponses = await Promise.all(
      sentRequests.map(async (sentRequest) => {
        // Check if there's a response for this request-supplier combination
        const responseResult = await db
          .select({
            responseDate: supplierResponses.responseDate,
            subject: supplierResponses.subject,
            content: supplierResponses.content,
            isRead: supplierResponses.isRead
          })
          .from(supplierResponses)
          .where(
            and(
              eq(supplierResponses.requestId, requestId),
              eq(supplierResponses.supplierId, sentRequest.supplierId)
            )
          )
          .limit(1);
        
        const hasResponse = responseResult.length > 0;
        const responseReceivedAt = hasResponse ? responseResult[0].responseDate : null;
        
        return {
          supplierId: sentRequest.supplierId,
          supplierName: sentRequest.supplierName,
          supplierEmail: sentRequest.supplierEmail,
          supplierWebsite: sentRequest.supplierWebsite,
          supplierPhone: sentRequest.supplierPhone,
          sentAt: sentRequest.sentAt,
          hasResponded: hasResponse,
          responseReceivedAt
        };
      })
    );
    
    console.log(`[Admin Client Requests API] Found ${sentRequestsWithResponses.length} sent requests for request ${requestId}`);
    
    res.status(200).json({
      requestId,
      sentRequests: sentRequestsWithResponses
    });
  } catch (error) {
    console.error('[Admin Client Requests API] Error fetching sent requests:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch sent requests'
    });
  }
});

// Debug endpoint to check data in staging_suppliers table
router.get('/debug/staging-suppliers', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Admin Client Requests API] Debug: Fetching staging suppliers');
    
    // Get all staging suppliers
    const allSuppliers = await db
      .select({
        id: stagingSuppliers.id,
        searchQuery: stagingSuppliers.searchQuery,
        sourceEngine: stagingSuppliers.sourceEngine,
        rawTitle: stagingSuppliers.rawTitle,
        requestId: stagingSuppliers.requestId,
        searchSessionId: stagingSuppliers.searchSessionId,
        userId: stagingSuppliers.userId,
        createdAt: stagingSuppliers.createdAt,
      })
      .from(stagingSuppliers)
      .orderBy(desc(stagingSuppliers.createdAt))
      .limit(20);
    
    console.log('[Admin Client Requests API] Debug: Found staging suppliers:', allSuppliers.length);
    console.log('[Admin Client Requests API] Debug: Sample suppliers:', allSuppliers);
    
    // Get unique search queries
    const uniqueQueries = await db
      .selectDistinct({
        searchQuery: stagingSuppliers.searchQuery,
        count: sql<number>`count(*)`
      })
      .from(stagingSuppliers)
      .groupBy(stagingSuppliers.searchQuery)
      .orderBy(desc(sql`count(*)`))
      .limit(10);
    
    console.log('[Admin Client Requests API] Debug: Unique queries:', uniqueQueries);
    
    res.status(200).json({
      totalSuppliers: allSuppliers.length,
      suppliers: allSuppliers,
      uniqueQueries: uniqueQueries
    });
  } catch (error) {
    console.error('[Admin Client Requests API] Debug error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch debug data'
    });
  }
});

// Debug endpoint to check data in search_requests table
router.get('/debug/search-requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Admin Client Requests API] Debug: Fetching all search requests');
    
    // Get all search requests without filters
    const allRequests = await db
      .select({
        id: searchRequests.id,
        userId: searchRequests.userId,
        productName: searchRequests.productName,
        productDescription: searchRequests.productDescription,
        createdAt: searchRequests.createdAt,
      })
      .from(searchRequests)
      .orderBy(desc(searchRequests.createdAt))
      .limit(10);
    
    console.log('[Admin Client Requests API] Debug: Found requests:', allRequests.length);
    console.log('[Admin Client Requests API] Debug: Sample requests:', allRequests);
    
    // Also check what's in staging_suppliers
    const stagingData = await db
      .select({
        searchQuery: stagingSuppliers.searchQuery,
        sourceEngine: stagingSuppliers.sourceEngine,
        createdAt: stagingSuppliers.createdAt,
      })
      .from(stagingSuppliers)
      .orderBy(desc(stagingSuppliers.createdAt))
      .limit(10);
    
    console.log('[Admin Client Requests API] Debug: Staging suppliers:', stagingData);
    
    res.status(200).json({
      total: allRequests.length,
      requests: allRequests,
      stagingSuppliers: stagingData
    });
  } catch (error) {
    console.error('[Admin Client Requests API] Debug error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch debug data'
    });
  }
});

// Fix request_id in staging_suppliers
router.post('/fix-request-ids', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Fix Request IDs] Starting request_id fix process...');
    
    // 1. Check how many records have NULL request_id
    const nullRequestIdCount = await db
      .select({ count: sql`COUNT(*)` })
      .from(stagingSuppliers)
      .where(sql`${stagingSuppliers.requestId} IS NULL`);
    
    console.log(`[Fix Request IDs] Found ${nullRequestIdCount[0]?.count || 0} records without request_id`);

    // 2. Update records based on searchSessionId
    console.log('[Fix Request IDs] Updating records based on searchSessionId...');
    const updateBySessionResult = await db.execute(sql`
      UPDATE staging_suppliers 
      SET request_id = sr.id
      FROM search_requests sr
      WHERE staging_suppliers.search_session_id = sr.search_session_id
        AND staging_suppliers.request_id IS NULL
        AND staging_suppliers.search_session_id IS NOT NULL
    `);
    
    console.log(`[Fix Request IDs] Updated ${updateBySessionResult.rowCount} records by searchSessionId`);

    // 3. Update records based on user, query and time
    console.log('[Fix Request IDs] Updating records based on user, query and time...');
    const updateByUserTimeResult = await db.execute(sql`
      UPDATE staging_suppliers 
      SET request_id = sr.id
      FROM search_requests sr
      WHERE staging_suppliers.user_id = sr.user_id
        AND staging_suppliers.search_query = sr.product_name
        AND staging_suppliers.request_id IS NULL
        AND ABS(EXTRACT(EPOCH FROM (staging_suppliers.created_at - sr.created_at))) < 1800
    `);
    
    console.log(`[Fix Request IDs] Updated ${updateByUserTimeResult.rowCount} records by user and time`);

    // 4. Update records based on user and time (wider range)
    console.log('[Fix Request IDs] Updating records based on user and time (wide range)...');
    const updateByUserTimeWideResult = await db.execute(sql`
      UPDATE staging_suppliers 
      SET request_id = sr.id
      FROM search_requests sr
      WHERE staging_suppliers.user_id = sr.user_id
        AND staging_suppliers.request_id IS NULL
        AND ABS(EXTRACT(EPOCH FROM (staging_suppliers.created_at - sr.created_at))) < 3600
        AND NOT EXISTS (
          SELECT 1 FROM staging_suppliers ss2 
          WHERE ss2.request_id = sr.id 
          AND ss2.id != staging_suppliers.id
        )
    `);
    
    console.log(`[Fix Request IDs] Updated ${updateByUserTimeWideResult.rowCount} records by user and time (wide range)`);

    // 5. Check final result
    const finalNullCount = await db
      .select({ count: sql`COUNT(*)` })
      .from(stagingSuppliers)
      .where(sql`${stagingSuppliers.requestId} IS NULL`);
    
    const totalCount = await db
      .select({ count: sql`COUNT(*)` })
      .from(stagingSuppliers);
    
    const updatedCount = (totalCount[0]?.count || 0) - (finalNullCount[0]?.count || 0);

    console.log(`[Fix Request IDs] Final result: ${updatedCount} records with request_id, ${finalNullCount[0]?.count || 0} without`);

    res.status(200).json({
      success: true,
      message: 'Request IDs fixed successfully',
      stats: {
        totalRecords: totalCount[0]?.count || 0,
        recordsWithRequestId: updatedCount,
        recordsWithoutRequestId: finalNullCount[0]?.count || 0,
        updatedBySession: updateBySessionResult.rowCount || 0,
        updatedByUserTime: updateByUserTimeResult.rowCount || 0,
        updatedByUserTimeWide: updateByUserTimeWideResult.rowCount || 0
      }
    });
  } catch (error) {
    console.error('[Fix Request IDs] Error:', error);
    res.status(500).json({
      error: 'Failed to fix request IDs',
      message: error.message
    });
  }
});

// Execute SQL script to fix request_ids
router.get('/execute-sql-fix', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[SQL Fix] Starting SQL-based request_id fix...');
    
    const sqlScript = `
      -- 1. Update records based on searchSessionId
      UPDATE staging_suppliers 
      SET request_id = sr.id
      FROM search_requests sr
      WHERE staging_suppliers.search_session_id = sr.search_session_id
        AND staging_suppliers.request_id IS NULL
        AND staging_suppliers.search_session_id IS NOT NULL;

      -- 2. Update records based on user, query and time (30 minutes)
      UPDATE staging_suppliers 
      SET request_id = sr.id
      FROM search_requests sr
      WHERE staging_suppliers.user_id = sr.user_id
        AND staging_suppliers.search_query = sr.product_name
        AND staging_suppliers.request_id IS NULL
        AND ABS(EXTRACT(EPOCH FROM (staging_suppliers.created_at - sr.created_at))) < 1800;

      -- 3. Update records based on user and time (60 minutes, no duplicates)
      UPDATE staging_suppliers 
      SET request_id = sr.id
      FROM search_requests sr
      WHERE staging_suppliers.user_id = sr.user_id
        AND staging_suppliers.request_id IS NULL
        AND ABS(EXTRACT(EPOCH FROM (staging_suppliers.created_at - sr.created_at))) < 3600
        AND NOT EXISTS (
          SELECT 1 FROM staging_suppliers ss2 
          WHERE ss2.request_id = sr.id 
          AND ss2.id != staging_suppliers.id
        );
    `;

    // Get all staging suppliers without requestId
    const suppliersWithoutRequestId = await db
      .select()
      .from(stagingSuppliers)
      .where(isNull(stagingSuppliers.requestId));

    console.log(`[SQL Fix] Found ${suppliersWithoutRequestId.length} suppliers without requestId`);

    let updatedCount = 0;

    // Try to match each supplier with a search request
    for (const supplier of suppliersWithoutRequestId) {
      let matchedRequest = null;

      // Step 1: Try to match by searchSessionId
      if (supplier.searchSessionId) {
        const sessionMatch = await db
          .select()
          .from(searchRequests)
          .where(eq(searchRequests.searchSessionId, supplier.searchSessionId))
          .limit(1);
        
        if (sessionMatch.length > 0) {
          matchedRequest = sessionMatch[0];
        }
      }

      // Step 2: Try to match by user, query and time (30 minutes)
      if (!matchedRequest) {
        const timeMatch = await db
          .select()
          .from(searchRequests)
          .where(
            and(
              eq(searchRequests.userId, supplier.userId),
              eq(searchRequests.productName, supplier.searchQuery),
              sql`ABS(EXTRACT(EPOCH FROM (${searchRequests.createdAt} - ${supplier.createdAt}))) < 1800`
            )
          )
          .limit(1);
        
        if (timeMatch.length > 0) {
          matchedRequest = timeMatch[0];
        }
      }

      // Step 3: Try to match by user and time (60 minutes)
      if (!matchedRequest) {
        const wideTimeMatch = await db
          .select()
          .from(searchRequests)
          .where(
            and(
              eq(searchRequests.userId, supplier.userId),
              sql`ABS(EXTRACT(EPOCH FROM (${searchRequests.createdAt} - ${supplier.createdAt}))) < 3600`
            )
          )
          .limit(1);
        
        if (wideTimeMatch.length > 0) {
          matchedRequest = wideTimeMatch[0];
        }
      }

      // Update the supplier with the matched request
      if (matchedRequest) {
        await db
          .update(stagingSuppliers)
          .set({ requestId: matchedRequest.id })
          .where(eq(stagingSuppliers.id, supplier.id));
        
        updatedCount++;
        console.log(`[SQL Fix] Updated supplier ${supplier.id} with request ${matchedRequest.id}`);
      }
    }

    console.log(`[SQL Fix] Updated ${updatedCount} suppliers`);

    // Check results
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_records,
        COUNT(request_id) as records_with_request_id,
        COUNT(*) - COUNT(request_id) as records_without_request_id
      FROM staging_suppliers
    `);

    const stats = result[0];

    console.log(`[SQL Fix] Results: ${stats.records_with_request_id} with request_id, ${stats.records_without_request_id} without`);

    res.status(200).json({
      success: true,
      message: 'SQL fix executed successfully',
      stats: {
        totalRecords: stats.total_records,
        recordsWithRequestId: stats.records_with_request_id,
        recordsWithoutRequestId: stats.records_without_request_id
      }
    });
  } catch (error) {
    console.error('[SQL Fix] Error:', error);
    res.status(500).json({
      error: 'Failed to execute SQL fix',
      message: error.message
    });
  }
});

// Debug endpoint to check search_requests data
router.get('/debug/search-requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Debug] Checking search_requests data...');
    
    // Get search requests count and samples
    const requestsCount = await db.select({ count: count() }).from(searchRequests);
    const requestsList = await db.select().from(searchRequests).limit(5);
    
    console.log('[Debug] Search requests count:', requestsCount[0]?.count);
    console.log('[Debug] Sample requests:', requestsList);
    
    res.status(200).json({
      requests: {
        count: requestsCount[0]?.count || 0,
        sample: requestsList
      }
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch search requests data'
    });
  }
});

export default router;
