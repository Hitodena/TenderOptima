import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { db } from '../db';
import { 
  searchRequests, 
  users, 
  stagingSuppliers, 
  requestSuppliers, 
  suppliers, 
  supplierResponses 
} from '@shared/schema';
import { eq, sql, and, desc, count, leftJoin, gte, lte } from 'drizzle-orm';

const router = Router();

// Middleware to verify admin access
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const userRole = (req.user as any)?.role;
    const isAdmin = userRole === 'admin' || (req.user as any)?.id === 1; // User ID 1 is considered admin
    
    if (!isAdmin) {
      console.log('[Admin Client Requests API] Access denied: User is not an admin');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can access this resource'
      });
    }
    
    next();
  } catch (error) {
    console.error('[Admin Client Requests API] Error in admin verification:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify admin privileges'
    });
  }
};

// GET /api/admin/client-requests - список заказов клиентов с поисковыми запросами
router.get('/client-requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Admin Client Requests API] Fetching client requests with search queries');
    
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
        
        if (request.searchSessionId) {
          // Use searchSessionId for precise matching
          const resultsCountResult = await db
            .select({ count: sql`COUNT(DISTINCT ${stagingSuppliers.rawTitle})` })
            .from(stagingSuppliers)
            .where(eq(stagingSuppliers.searchSessionId, request.searchSessionId));
          
          resultsCount = resultsCountResult[0]?.count || 0;
          
          // Get the search query from staging_suppliers for this session
          const searchQueryResult = await db
            .select({ searchQuery: stagingSuppliers.searchQuery })
            .from(stagingSuppliers)
            .where(eq(stagingSuppliers.searchSessionId, request.searchSessionId))
            .limit(1);
          
          if (searchQueryResult.length > 0) {
            searchQuery = searchQueryResult[0].searchQuery;
          }
        } else {
          // Fallback to old logic if no searchSessionId
          const timeRange = new Date(request.createdAt);
          timeRange.setMinutes(timeRange.getMinutes() - 30);
          const timeRangeEnd = new Date(request.createdAt);
          timeRangeEnd.setMinutes(timeRangeEnd.getMinutes() + 30);
          
          const resultsCountResult = await db
            .select({ count: sql`COUNT(DISTINCT ${stagingSuppliers.rawTitle})` })
            .from(stagingSuppliers)
            .where(
              and(
                eq(stagingSuppliers.userId, request.userId),
                gte(stagingSuppliers.createdAt, timeRange),
                lte(stagingSuppliers.createdAt, timeRangeEnd)
              )
            );
          
          resultsCount = resultsCountResult[0]?.count || 0;
        }
        
        // Count sent requests from request_suppliers
        const sentRequestsCountResult = await db
          .select({ count: count() })
          .from(requestSuppliers)
          .where(eq(requestSuppliers.requestId, request.id));
        
        const sentRequestsCount = sentRequestsCountResult[0]?.count || 0;
        
        // Try to find the actual search query from staging_suppliers
        // Look for staging suppliers that match this request's user and product name
        const searchQueryResult = await db
          .select({ searchQuery: stagingSuppliers.searchQuery })
          .from(stagingSuppliers)
          .where(
            and(
              eq(stagingSuppliers.userId, request.userId),
              eq(stagingSuppliers.searchQuery, request.productName)
            )
          )
          .limit(1);
        
        console.log(`[Admin Client Requests API] Request ${request.id}: productName="${request.productName}", found searchQuery:`, searchQueryResult);
        
        let queryText = '';
        if (searchQueryResult.length > 0 && searchQueryResult[0].searchQuery) {
          // Use the actual search query from staging_suppliers
          queryText = searchQueryResult[0].searchQuery;
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
    
    console.log(`[Admin Client Requests API] Using search query: "${searchQuery}" for request ${requestId}`);
    
    // Get all staging suppliers for this search query
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
      .where(eq(stagingSuppliers.searchQuery, searchQuery))
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

export default router;
