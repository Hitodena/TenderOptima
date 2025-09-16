import { 
  type Supplier, 
  type SearchRequest, 
  type InsertSearchRequest, 
  type SupplierMatch,
  type RequestSupplier,
  type InsertRequestSupplier,
  type SupplierResponse,
  type InsertSupplierResponse,
  type User,
  type InsertUser,
  type AnalysisResult,
  type InsertAnalysisResult,
  type ContactGroup,
  type InsertContactGroup,
  type ContactItem,
  type InsertContactItem,
  type EmailRequest,
  type InsertEmailRequest,
  type RequestSupplierGroup,
  type ExtractedParameter,
  type InsertExtractedParameter,
  type InsertRequestSupplierGroup,
  type SupplierMessage,
  type InsertSupplierMessage,
  type RequestParameter,
  type InsertRequestParameter,
  suppliers,
  searchRequests,
  requestSuppliers,
  supplierResponses,
  users,
  analysisResults,
  contactGroups,
  contactItems,
  emailRequests,
  requestSupplierGroups,
  requestSupplierMessages,
  requestParameters,
  extractedParameters,
  improvementRequests,
  winnerSelections
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, inArray, count, sql, isNull, isNotNull } from "drizzle-orm";
import { matchingService } from "./matching-service";
import { nanoid } from "nanoid";

export interface IStorage {
  // User operations
  createUser(user: InsertUser): Promise<User>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  updateUserLastLogin(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersWithEmailConfig(): Promise<Array<{ id: number; emailAccount: string }>>;
  updateUserEmailConfig(userId: number, config: any): Promise<boolean>;
  getUserEmailConfig(userId: number): Promise<any>;
  resetUserEmailConfig(userId: number): Promise<boolean>;
  
  // Supplier operations
  getSuppliers(): Promise<Supplier[]>;
  findSupplierResponseByMessageId(messageId: string, userId: number): Promise<SupplierResponse | undefined>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  
  // Parameter operations
  getParametersForRequest(requestId: number): Promise<RequestParameter | undefined>;
  saveParametersForRequest(requestId: number, parameters: any): Promise<RequestParameter>;
  deleteParametersForRequest(requestId: number): Promise<boolean>;
  
  // Extracted parameter operations
  saveExtractedParameters(parameters: InsertExtractedParameter): Promise<ExtractedParameter>;
  getExtractedParametersByResponseId(responseId: number): Promise<ExtractedParameter | undefined>;
  getExtractedParametersByRequestId(requestId: number): Promise<ExtractedParameter[]>;
  getExtractedParametersByEmail(requestId: number, email: string): Promise<ExtractedParameter | undefined>;
  updateExtractedParameters(responseId: number, userId?: number, parameters?: Record<string, any>): Promise<boolean>;
  getSupplierByStringId(id: string): Promise<Supplier | undefined>;
  getSupplierByEmail(email: string): Promise<Supplier | undefined>;
  searchSuppliers(searchRequest: SearchRequest): Promise<Supplier[]>;
  getSupplierGroups(supplierId: number): Promise<number[]>;
  
  // Supplier Message operations
  getSupplierMessageById(id: number): Promise<SupplierMessage | undefined>;
  getSupplierMessages(requestSupplierId: number, userId?: number): Promise<SupplierMessage[]>;
  addSupplierMessage(message: InsertSupplierMessage): Promise<SupplierMessage>;
  updateSupplierGroups(supplierId: number, groupIds: number[]): Promise<{ success: boolean }>;
  
  // Search request operations
  createSearchRequest(request: InsertSearchRequest): Promise<SearchRequest>;
  getSearchRequest(id: number): Promise<SearchRequest | undefined>;
  getSearchRequestByOrderNumber(orderNumber: string): Promise<SearchRequest | undefined>;
  getAllSearchRequests(userId?: number): Promise<SearchRequest[]>; // Optional userId to filter by user
  updateSearchRequestStatus(id: number, status: string): Promise<SearchRequest | undefined>;
  
  // Request supplier operations
  createRequestSupplier(request: InsertRequestSupplier): Promise<RequestSupplier>;
  getRequestSuppliers(requestId: number | null): Promise<RequestSupplier[]>;
  getRequestSupplierById(id: number): Promise<RequestSupplier | undefined>;
  getRequestSupplierByTrackingId(trackingId: string): Promise<RequestSupplier | undefined>;
  getRequestSupplierByRequestAndEmail(requestId: number, email: string): Promise<RequestSupplier | undefined>;
  updateRequestSupplierResponse(id: number, hasResponded: boolean): Promise<RequestSupplier | undefined>;
  
  // Supplier response operations
  createSupplierResponse(response: InsertSupplierResponse): Promise<SupplierResponse>;
  getSupplierResponses(requestId: number | null): Promise<SupplierResponse[]>;
  getAllSupplierResponsesForRequests(requestIds: number[]): Promise<SupplierResponse[]>;
  getSupplierResponseById(id: number): Promise<SupplierResponse | undefined>;
  markSupplierResponseAsRead(id: number): Promise<SupplierResponse | undefined>;
  toggleFavoriteResponse(id: number): Promise<SupplierResponse | undefined>;
  getSupplierResponseWithMessage(responseId: number): Promise<any>;
  getSupplierResponsesWithMessages(requestId: number): Promise<any[]>;
  checkExistingSupplierResponseByMessageId(messageId: string): Promise<SupplierResponse | undefined>;
  
  // Analysis results operations
  createAnalysisResult(result: InsertAnalysisResult): Promise<AnalysisResult>;
  getAnalysisResults(requestId: number): Promise<AnalysisResult[]>;
  getAnalysisResultById(id: number): Promise<AnalysisResult | undefined>;
  
  // Contact group operations
  createContactGroup(group: InsertContactGroup): Promise<ContactGroup>;
  getContactGroups(userId?: number): Promise<ContactGroup[]>;
  getContactGroupById(id: number, userId?: number): Promise<ContactGroup | undefined>;
  updateContactGroup(id: number, group: Partial<InsertContactGroup>): Promise<ContactGroup | undefined>;
  deleteContactGroup(id: number): Promise<boolean>;
  
  // Contact item operations
  createContactItem(item: InsertContactItem): Promise<ContactItem>;
  getContactItemsByGroupId(groupId: number): Promise<ContactItem[]>;
  getContactItemsByEmail(groupId: number, email: string): Promise<ContactItem[]>;
  getContactCountsByGroupIds(groupIds: number[], userId?: number): Promise<Record<number, number>>;
  getContactById(contactId: number): Promise<ContactItem | null>;
  getContactsByEmail(email: string, userId?: number): Promise<ContactItem[]>;
  updateContactItem(id: number, item: Partial<InsertContactItem>): Promise<ContactItem | undefined>;
  deleteContactItem(id: number): Promise<boolean>;
  addContactsToGroup(groupId: number, contacts: Array<Partial<InsertContactItem>>): Promise<ContactItem[]>;
  
  // Supplier message operations
  getSupplierMessageById(id: number): Promise<SupplierMessage | undefined>;
  getSupplierMessages(requestSupplierId: number): Promise<SupplierMessage[]>;
  addSupplierMessage(message: InsertSupplierMessage): Promise<SupplierMessage>;
  
  // Email request operations
  createEmailRequest(request: InsertEmailRequest): Promise<EmailRequest>;
  getEmailRequestById(id: number): Promise<EmailRequest | undefined>;
  getEmailRequestsByGroupId(groupId: number): Promise<EmailRequest[]>;
  updateEmailRequestStatus(id: number, status: string): Promise<EmailRequest | undefined>;
  
  // Request supplier to contact group operations
  addSupplierToContactGroup(data: InsertRequestSupplierGroup): Promise<RequestSupplierGroup>;
  getContactGroupsByRequestSupplierId(requestSupplierId: number): Promise<ContactGroup[]>;
  removeSupplierFromContactGroup(requestSupplierId: number, contactGroupId: number): Promise<boolean>;
  
  // Improvement request operations
  logImprovementRequest(request: {
    requestId: number;
    supplierId?: string;
    supplierEmail: string;
    supplierName: string;
    subject: string;
    message: string;
    requestType?: string;
    trackingId?: string;
    sentAt?: Date;
    userId?: number;
  }): Promise<void>;
  getImprovementRequestCounts(requestId: number): Promise<Record<string, number>>;
  
  // Winner selection operations
  createWinnerSelection(selection: any): Promise<any>;
  getWinnerByRequestId(requestId: number): Promise<any>;
  deleteWinnerSelection(requestId: number): Promise<boolean>;
  
  // Helper functions
  generateOrderNumber(): string;
  generateTrackingId(): string;
}

export class DatabaseStorage implements IStorage {
  /**
   * Get a supplier by email
   * @param email The email address of the supplier
   * @returns The supplier or undefined if not found
   */
  async getSupplierByEmail(email: string): Promise<Supplier | undefined> {
    try {
      if (!email) {
        return undefined;
      }
      
      // Find supplier by email address
      const [supplier] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.email, email));
      
      if (!supplier) {
        return undefined;
      }
      
      return supplier;
    } catch (error) {
      console.error(`Error getting supplier by email ${email}:`, error);
      return undefined;
    }
  }
  
  // Get a supplier response with full message content for attachment analysis
  async getSupplierResponseWithMessage(responseId: number): Promise<any> {
    try {
      const [response] = await db
        .select()
        .from(supplierResponses)
        .where(eq(supplierResponses.id, responseId));
      
      if (!response) {
        return null;
      }
      
      return response;
    } catch (error) {
      console.error(`Error getting supplier response with message ${responseId}:`, error);
      return null;
    }
  }
  
  // Get all supplier responses with full message content for a request
  async getSupplierResponsesWithMessages(requestId: number): Promise<any[]> {
    try {
      const responses = await db
        .select()
        .from(supplierResponses)
        .where(eq(supplierResponses.requestId, requestId))
        .orderBy(desc(supplierResponses.responseDate));
      
      return responses;
    } catch (error) {
      console.error(`Error getting supplier responses with messages for request ${requestId}:`, error);
      return [];
    }
  }
  
  async checkExistingSupplierResponseByMessageId(messageId: string): Promise<SupplierResponse | undefined> {
    try {
      const [existingResponse] = await db
        .select()
        .from(supplierResponses)
        .where(eq(supplierResponses.messageId, messageId));
      return existingResponse;
    } catch (error) {
      console.error(`Error checking existing supplier response by messageId ${messageId}:`, error);
      return undefined;
    }
  }

  async findSupplierResponseByMessageId(messageId: string, userId: number): Promise<SupplierResponse | undefined> {
    try {
      const [existingResponse] = await db
        .select()
        .from(supplierResponses)
        .where(and(
          eq(supplierResponses.messageId, messageId),
          eq(supplierResponses.userId, userId)
        ));
      return existingResponse;
    } catch (error) {
      console.error(`Error finding supplier response by messageId ${messageId} for user ${userId}:`, error);
      return undefined;
    }
  }
  
  // User operations
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db
      .insert(users)
      .values(user)
      .returning();
    return newUser;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async updateUserLastLogin(id: number): Promise<User | undefined> {
    const now = new Date();
    const [updatedUser] = await db
      .update(users)
      .set({ lastLogin: now })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const allUsers = await db.select().from(users);
      return allUsers;
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }



  // REMOVED: Duplicate function that returned hasPassword instead of actual emailPassword
  // Using the correct implementation at line 2555 instead

  
  // Supplier operations
  async getSuppliers(userId?: number): Promise<Supplier[]> {
    // If userId is provided, filter by user
    if (userId) {
      console.log(`[storage] getSuppliers filtering by userId: ${userId}`);
      return await db.select().from(suppliers).where(eq(suppliers.userId, userId));
    }
    
    // Otherwise return all suppliers (admin use case)
    return await db.select().from(suppliers);
  }
  
  async getSupplier(id: number): Promise<Supplier | undefined> {
    console.log(`[storage] getSupplier called with ID: ${id} (type: ${typeof id})`);
    
    // Handle numeric IDs normally
    try {
      // Преобразуем id в число, если это строка
      const numericId = typeof id === 'string' ? parseInt(id as any) : id;
      
      if (isNaN(numericId)) {
        console.log(`[storage] getSupplier received invalid ID: "${id}"`);
        return undefined;
      }
      
      // Базовый запрос по числовому ID
      const [supplier] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id as any, numericId));
      
      console.log(`[storage] getSupplier result: ${supplier ? 'found' : 'not found'}`);
      
      if (supplier) {
        return supplier;
      } else {
        // Расширенный поиск - попробуем найти по string ID если числовой поиск не удался
        console.log(`[storage] Trying to find supplier with string ID: "${id}"`);
        const stringId = String(id);
        
        const [supplierByString] = await db
          .select()
          .from(suppliers)
          .where(sql`${suppliers.id} = ${stringId}`);
          
        console.log(`[storage] getSupplier string lookup result: ${supplierByString ? 'found' : 'not found'}`);
        return supplierByString;
      }
    } catch (error) {
      console.error(`[storage] Error in getSupplier(${id}):`, error);
      return undefined;
    }
  }
  
  // Additional helper method to get supplier by string ID
  async getSupplierByStringId(id: string): Promise<Supplier | undefined> {
    console.log(`[storage] getSupplierByStringId called with ID: ${id} (type: ${typeof id})`);
    
    try {
      // Сначала прямой поиск строки
      console.log(`[storage] Trying direct string lookup for ID: "${id}"`);
      
      // Используем SQL для безопасного сравнения (избегаем LSP ошибку)
      const [directSupplier] = await db
        .select()
        .from(suppliers)
        .where(sql`${suppliers.id} = ${id}`);
      
      if (directSupplier) {
        console.log(`[storage] getSupplierByStringId direct lookup success: ${directSupplier.name}`);
        return directSupplier;
      }
      
      // Затем попробуем преобразовать в число
      const numericId = parseInt(id);
      if (!isNaN(numericId)) {
        console.log(`[storage] String ID converted to number: ${numericId}`);
        const supplier = await this.getSupplier(numericId);
        console.log(`[storage] Numeric lookup result: ${supplier ? 'found' : 'not found'}`);
        return supplier;
      } else {
        console.log(`[storage] ID "${id}" is not a valid number`);
      }
      
      // Дополнительная попытка поиска - проверим в таблице requestSuppliers
      console.log('[storage] Checking if this is a response ID from supplier_responses table');
      try {
        const [supplierResponse] = await db
          .select()
          .from(supplierResponses)
          .where(sql`${supplierResponses.id} = ${id}`);
        
        if (supplierResponse) {
          console.log(`[storage] Found supplier response with ID ${id}, getting supplier info`);
          
          // Используем email из supplierResponse
          const [foundSupplier] = await db
            .select()
            .from(suppliers)
            .where(sql`${suppliers.email} = ${supplierResponse.supplierEmail}`);
          
          if (foundSupplier) {
            console.log(`[storage] Found supplier by email: ${foundSupplier.name}`);
            return foundSupplier;
          }
          
          // Если не нашли по email, создаем временный объект поставщика
          return {
            id: parseInt(supplierResponse.supplierId),
            name: supplierResponse.supplierName,
            email: supplierResponse.supplierEmail,
            phone: "",
            description: `Supplier from response ${id}`,
            website: "",
            categories: [],
            responseRate: null,
            totalRequests: null, 
            successfulMatches: null,
            keywordStrength: null,
            lastResponseTime: null
          };
        }
      } catch (respError) {
        console.error(`[storage] Error checking supplier responses:`, respError);
      }
    } catch (error) {
      console.error(`[storage] Error in getSupplierByStringId("${id}"):`, error);
    }
    
    console.log(`[storage] getSupplierByStringId for "${id}" returning undefined (not found)`);
    return undefined;
  }

  async searchSuppliers(searchRequest: SearchRequest): Promise<Supplier[]> {
    console.log('Search request with options:', {
      ...searchRequest,
      useDbSearch: searchRequest.useDbSearch ?? true,
      useApiSearch: searchRequest.useApiSearch ?? false,
      userId: searchRequest.userId
    });
    
    // Start with empty array or database suppliers based on options
    let allSuppliers: Supplier[] = [];
    
    // Add database suppliers if enabled (default: true)
    if (searchRequest.useDbSearch !== false) {
      // Filter suppliers by user ID for multi-tenant isolation
      allSuppliers = await this.getSuppliers(searchRequest.userId);
      console.log(`Using database suppliers for user ${searchRequest.userId}: ${allSuppliers.length} suppliers loaded`);
    } else {
      console.log('Database search disabled by user');
    }
    
    // Get matches from the matching service - the API search happens inside the matching service
    // The API search will only run if useApiSearch is true
    const useApiSearch = searchRequest.useApiSearch === true;
    console.log(`API search ${useApiSearch ? 'enabled' : 'disabled'} by user`);
    
    const matches = await matchingService.matchSuppliers(allSuppliers, {
      ...searchRequest,
      useApiSearch
    });
    
    console.log('Matched suppliers with scores:', 
      matches.map(m => ({name: m.name, score: m.matchScore})));
    console.log('Number of matched suppliers:', matches.length);
    
    // Return the suppliers without the matching metadata
    return matches.map(match => {
      const { matchScore, matchDetails, ...supplier } = match;
      return supplier;
    });
  }

  // Search request operations
  async createSearchRequest(request: InsertSearchRequest): Promise<SearchRequest> {
    // Always generate a new order number here to ensure consistency
    const orderNumber = this.generateOrderNumber();
    console.log(`Generated order number: ${orderNumber} for new search request`);
    
    // Create the search request with the generated order number
    const [searchRequest] = await db
      .insert(searchRequests)
      .values({
        ...request,
        orderNumber
      })
      .returning();
    
    return searchRequest;
  }

  async getSearchRequest(id: number, userId?: number): Promise<SearchRequest | undefined> {
    console.log(`[storage] Getting search request ID ${id}${userId ? ` for user ID ${userId}` : ''}`);
    
    // Build query conditions
    let conditions = userId !== undefined 
      ? and(eq(searchRequests.id, id), eq(searchRequests.userId, userId))
      : eq(searchRequests.id, id);
    
    if (userId !== undefined) {
      console.log(`[storage] Applying user filter for user ID ${userId}`);
    }
    
    const [searchRequest] = await db
      .select()
      .from(searchRequests)
      .where(conditions);
      
    if (!searchRequest) {
      console.log(`[storage] Search request ID ${id}${userId ? ` for user ID ${userId}` : ''} not found`);
      return undefined;
    }
    
    console.log(`[storage] Retrieved search request ID ${id} for user ${searchRequest.userId}`);
    return searchRequest;
  }

  async getSearchRequestByOrderNumber(orderNumber: string, userId?: number): Promise<SearchRequest | undefined> {
    console.log(`[Server] Getting search request by order number ${orderNumber} ${userId ? `for user ID ${userId}` : ''}`);
    
    // Build query conditions
    let conditions = userId 
      ? and(eq(searchRequests.orderNumber, orderNumber), eq(searchRequests.userId, userId))
      : eq(searchRequests.orderNumber, orderNumber);
    
    const [searchRequest] = await db
      .select()
      .from(searchRequests)
      .where(conditions);
      
    if (!searchRequest) {
      console.log(`[Server] Search request with order number ${orderNumber} ${userId ? `for user ID ${userId}` : ''} not found`);
    }
    
    return searchRequest;
  }

  async getAllSearchRequests(userId?: number): Promise<SearchRequest[]> {
    console.log(`[storage] SECURITY: Fetching search requests - userId provided: ${userId !== undefined}`);
    
    // CRITICAL SECURITY: Always require userId for data isolation
    if (userId === undefined) {
      console.error(`[storage] SECURITY VIOLATION: Attempted to fetch all requests without user filter`);
      throw new Error("User ID is required for data access - security violation prevented");
    }
    
    const results = await db
      .select()
      .from(searchRequests)
      .where(eq(searchRequests.userId, userId))
      .orderBy(desc(searchRequests.createdAt));
    
    console.log(`[Storage] SECURITY: Found ${results.length} search requests for user ${userId}`);
    
    // SECURITY: Double-check user ownership
    const secureResult = results.filter(req => req.userId === userId);
    if (secureResult.length !== results.length) {
      console.error(`[Storage] SECURITY BREACH: Found requests not belonging to user ${userId}`);
    }
    
    return secureResult as SearchRequest[];
  }

  async updateSearchRequestStatus(id: number, status: string, userId?: number): Promise<SearchRequest | undefined> {
    // Build query conditions
    let conditions = userId 
      ? and(eq(searchRequests.id, id), eq(searchRequests.userId, userId))
      : eq(searchRequests.id, id);
    
    const [updatedRequest] = await db
      .update(searchRequests)
      .set({ status })
      .where(conditions)
      .returning();
    return updatedRequest;
  }

  // Request supplier operations
  async createRequestSupplier(request: InsertRequestSupplier): Promise<RequestSupplier> {
    // Generate a tracking ID if not provided
    if (!request.trackingId) {
      request.trackingId = this.generateTrackingId();
    }

    const [requestSupplier] = await db
      .insert(requestSuppliers)
      .values(request)
      .returning();
    return requestSupplier;
  }

  async getRequestSuppliers(requestId: number | null, userId?: number): Promise<RequestSupplier[]> {
    console.log(`[storage] Getting request suppliers for request ${requestId}${userId ? ` for user ${userId}` : ''}`);
    
    if (requestId === null) {
      console.log(`[storage] RequestId is null, returning empty array`);
      return [];
    }
    
    // First verify the request belongs to the user if userId is provided
    if (userId !== undefined) {
      const request = await this.getSearchRequest(requestId, userId);
      if (!request) {
        console.log(`[storage] Access denied: Request ${requestId} not found for user ${userId}`);
        return [];
      }
    }
    
    // Build the base query
    let query = db.select().from(requestSuppliers);
    
    // Start with requestId filter if provided
    let conditions = requestId !== null ? 
      eq(requestSuppliers.requestId, requestId) : 
      undefined;
    
    // Add userId filter if provided (for data isolation)
    if (userId) {
      const userFilter = eq(requestSuppliers.userId, userId);
      conditions = conditions ? and(conditions, userFilter) : userFilter;
    }
    
    // Apply conditions if any
    if (conditions) {
      query = query.where(conditions);
    }
    
    return await query;
  }

  async getRequestSupplierById(id: number): Promise<RequestSupplier | undefined> {
    try {
      console.log(`[storage] Getting request supplier with ID ${id}`);
      const [requestSupplier] = await db
        .select()
        .from(requestSuppliers)
        .where(eq(requestSuppliers.id, id));
      
      console.log(`[storage] Request supplier found: ${requestSupplier ? 'yes' : 'no'}`);
      return requestSupplier;
    } catch (error) {
      console.error(`[storage] Error getting request supplier with ID ${id}:`, error);
      return undefined;
    }
  }

  async getRequestSupplierByTrackingId(trackingId: string): Promise<RequestSupplier | undefined> {
    const [requestSupplier] = await db
      .select()
      .from(requestSuppliers)
      .where(eq(requestSuppliers.trackingId, trackingId));
    return requestSupplier;
  }

  async getRequestSupplierByRequestAndEmail(requestId: number, email: string): Promise<RequestSupplier | undefined> {
    try {
      const [requestSupplier] = await db
        .select()
        .from(requestSuppliers)
        .where(
          and(
            eq(requestSuppliers.requestId, requestId),
            eq(requestSuppliers.supplierEmail, email)
          )
        );
      return requestSupplier;
    } catch (error) {
      console.error(`Error finding request supplier for requestId=${requestId}, email=${email}:`, error);
      return undefined;
    }
  }

  async updateRequestSupplierResponse(id: number, hasResponded: boolean): Promise<RequestSupplier | undefined> {
    const [updatedSupplier] = await db
      .update(requestSuppliers)
      .set({ hasResponded })
      .where(eq(requestSuppliers.id, id))
      .returning();
    return updatedSupplier;
  }

  // Supplier response operations
  async createSupplierResponse(response: InsertSupplierResponse & { messageId?: string }): Promise<SupplierResponse> {
    // Do not auto-create parameters - respect user's parameter selection choices
    // If user didn't select parameters for a request, that's intentional
    
    // Используем расширенный тип с опциональным полем messageId
    const [supplierResponse] = await db
      .insert(supplierResponses)
      .values(response as any) // Используем any, чтобы обойти типизацию до обновления схемы
      .returning();
    
    // Update the corresponding requestSupplier record to show that a response was received
    if (response.requestSupplierId) {
      await this.updateRequestSupplierResponse(response.requestSupplierId, true);
    } else {
      // Look up the requestSupplier by requestId and supplierId/email
      const [requestSupplier] = await db
        .select()
        .from(requestSuppliers)
        .where(
          and(
            eq(requestSuppliers.requestId, response.requestId),
            or(
              eq(requestSuppliers.supplierId, response.supplierId),
              eq(requestSuppliers.supplierEmail, response.supplierEmail)
            )
          )
        );
      
      if (requestSupplier) {
        await this.updateRequestSupplierResponse(requestSupplier.id, true);
      }
    }
    
    return supplierResponse;
  }

  async getSupplierResponses(requestId: number | null, userId?: number): Promise<SupplierResponse[]> {
    const startTime = Date.now();
    console.log(`[storage] OPTIMIZED: Getting supplier responses for request ${requestId}${userId ? ` for user ${userId}` : ''} (WITHOUT ATTACHMENTS)`);
    
    if (requestId === null) {
      console.log(`[storage] RequestId is null, returning empty array`);
      return [];
    }
    
    // OPTIMIZED: Select only essential fields, exclude attachments completely
    let query = db.select({
      id: supplierResponses.id,
      requestId: supplierResponses.requestId,
      userId: supplierResponses.userId,
      supplierEmail: supplierResponses.supplierEmail,
      subject: supplierResponses.subject,
      content: supplierResponses.content,
      responseDate: supplierResponses.responseDate,
      isRead: supplierResponses.isRead,
      processingStatus: supplierResponses.processingStatus,
      processingStartedAt: supplierResponses.processingStartedAt,
      processingCompletedAt: supplierResponses.processingCompletedAt,
      processingError: supplierResponses.processingError,
      supplierId: supplierResponses.supplierId,
      supplierName: supplierResponses.supplierName,
      requestSupplierId: supplierResponses.requestSupplierId,
      isRepliedTo: supplierResponses.isRepliedTo,
      isFavorite: supplierResponses.isFavorite,
      messageId: supplierResponses.messageId,
      isAnalyzed: supplierResponses.isAnalyzed
      // НЕ включаем attachments - загружаем отдельно!
    }).from(supplierResponses);
    
    // Start with requestId filter if provided
    let conditions = requestId !== null ? 
      eq(supplierResponses.requestId, requestId) : 
      undefined;
    
    // Add userId filter if provided (for data isolation)
    if (userId) {
      const userFilter = eq(supplierResponses.userId, userId);
      conditions = conditions ? 
        and(conditions, userFilter) : 
        userFilter;
    }
    
    // Apply conditions if any
    if (conditions) {
      query = query.where(conditions);
    }
    
    // Order by response date descending
    const dbStartTime = Date.now();
    console.log(`[storage] Executing database query for request ${requestId}...`);
    const results = await query.orderBy(desc(supplierResponses.responseDate));
    const dbTime = Date.now() - dbStartTime;
    console.log(`[storage] Database query took ${dbTime}ms for ${results.length} responses`);
    console.log(`[storage] Query conditions: requestId=${requestId}, userId=${userId}`);
    
    // Add empty attachments array - будет загружаться отдельно
    const processedResults = results.map(response => ({
      ...response,
      attachments: [] // Пустой массив - загружаем отдельно
    }));
    
    const totalTime = Date.now() - startTime;
    console.log(`[storage] OPTIMIZED: Returning ${results.length} responses without attachments for faster loading`);
    console.log(`[storage] Performance: DB=${dbTime}ms, Total=${totalTime}ms`);
    
    // Проверяем размер данных
    const dataSize = JSON.stringify(processedResults).length;
    console.log(`[storage] Data size: ${(dataSize / 1024 / 1024).toFixed(2)} MB`);
    
    return processedResults;
  }

  // Get attachment metadata for a specific response
  async getSupplierResponseAttachments(responseId: number, userId?: number): Promise<any[]> {
    console.log(`[storage] OPTIMIZED: Getting attachments metadata for response ${responseId}${userId ? ` for user ${userId}` : ''}`);
    
    const startTime = Date.now();
    
    try {
      // OPTIMIZED: Use a more efficient query with proper indexing
      const response = await db
        .select({ attachments: supplierResponses.attachments })
        .from(supplierResponses)
        .where(
          userId 
            ? and(
                eq(supplierResponses.id, responseId),
                eq(supplierResponses.userId, userId)
              )
            : eq(supplierResponses.id, responseId)
        )
        .limit(1);
      
      const dbTime = Date.now() - startTime;
      console.log(`[storage] Attachments metadata query took ${dbTime}ms`);
      
      if (!response || response.length === 0) {
        console.log(`[storage] No response found for ID ${responseId}`);
        return [];
      }
      
      const attachments = response[0].attachments as any[];
      if (!attachments || !Array.isArray(attachments)) {
        console.log(`[storage] No attachments array found for response ${responseId}`);
        return [];
      }
      
      // Return only metadata, no content - this is the key optimization
      const metadata = attachments.map(attachment => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        extractedText: attachment.extractedText,
        processingStatus: attachment.processingStatus || 'pending'
        // НЕ включаем content - загружаем по требованию
      }));

      console.log(`[storage] OPTIMIZED: Returning ${metadata.length} attachment metadata entries (without content)`);
      return metadata;
    } catch (error) {
      const dbTime = Date.now() - startTime;
      console.error(`[storage] Error getting attachments metadata for response ${responseId} after ${dbTime}ms:`, error);
      return [];
    }
  }

  // Get full attachment content for download
  async getSupplierResponseAttachmentContent(responseId: number, filename: string, userId?: number): Promise<{ content: string; contentType: string } | null> {
    console.log(`[storage] Getting attachment content ${filename} for response ${responseId}${userId ? ` for user ${userId}` : ''}`);
    
    const response = await db
      .select({ attachments: supplierResponses.attachments })
      .from(supplierResponses)
      .where(
        userId 
          ? and(
              eq(supplierResponses.id, responseId),
              eq(supplierResponses.userId, userId)
            )
          : eq(supplierResponses.id, responseId)
      )
      .limit(1);
    
    if (!response || response.length === 0) {
      return null;
    }
    
    const attachments = response[0].attachments as any[];
    if (!attachments || !Array.isArray(attachments)) {
      return null;
    }
    
    // Find the requested attachment
    const attachment = attachments.find((att: any) => att.filename === filename);
    
    if (!attachment || !attachment.content) {
      return null;
    }
    
    return {
      content: attachment.content,
      contentType: attachment.contentType || 'application/octet-stream'
    };
  }


  // Get supplier response with full attachments
  async getSupplierResponseWithAttachments(responseId: number, userId?: number): Promise<SupplierResponse | null> {
    console.log(`[storage] Getting supplier response with attachments: ${responseId}${userId ? ` for user ${userId}` : ''}`);
    
    const response = await db
      .select()
      .from(supplierResponses)
      .where(
        userId 
          ? and(
              eq(supplierResponses.id, responseId),
              eq(supplierResponses.userId, userId)
            )
          : eq(supplierResponses.id, responseId)
      )
      .limit(1);
    
    if (!response || response.length === 0) {
      return null;
    }
    
    const result = response[0];
    return {
      ...result,
      attachments: result.attachments as any[] || [],
      supplierId: result.supplierEmail,
      supplierName: result.supplierName || result.supplierEmail,
      requestSupplierId: result.requestSupplierId,
      isRepliedTo: result.isRepliedTo || false,
      isFavorite: result.isFavorite || false,
      messageId: result.messageId
    };
  }

  // Update supplier response attachments
  async updateSupplierResponseAttachments(responseId: number, attachments: any[]): Promise<void> {
    console.log(`[storage] Updating attachments for response ${responseId}: ${attachments.length} attachments`);
    
    await db
      .update(supplierResponses)
      .set({ 
        attachments: attachments,
        processingStatus: 'completed',
        processingCompletedAt: new Date()
      })
      .where(eq(supplierResponses.id, responseId));
    
    console.log(`[storage] Successfully updated attachments for response ${responseId}`);
  }

  // Get unprocessed supplier responses (with attachments but no extractedText)
  async getUnprocessedSupplierResponses(userId: number): Promise<SupplierResponse[]> {
    console.log(`[storage] Getting unprocessed supplier responses for user ${userId}`);
    
    const responses = await db
      .select()
      .from(supplierResponses)
      .where(
        and(
          eq(supplierResponses.userId, userId),
          // Has attachments but no processing status or not completed
          or(
            isNull(supplierResponses.processingStatus),
            eq(supplierResponses.processingStatus, 'pending'),
            eq(supplierResponses.processingStatus, 'failed')
          )
        )
      )
      .orderBy(desc(supplierResponses.responseDate));
    
    // Filter responses that actually have attachments
    const responsesWithAttachments = responses.filter(response => {
      const attachments = response.attachments as any[];
      return attachments && Array.isArray(attachments) && attachments.length > 0;
    });
    
    console.log(`[storage] Found ${responsesWithAttachments.length} unprocessed responses with attachments`);
    
    return responsesWithAttachments.map(response => ({
      ...response,
      attachments: response.attachments as any[] || [],
      supplierId: response.supplierEmail,
      supplierName: response.supplierName || response.supplierEmail,
      requestSupplierId: response.requestSupplierId,
      isRepliedTo: response.isRepliedTo || false,
      isFavorite: response.isFavorite || false,
      messageId: response.messageId
    }));
  }
  
  // Получение ответов поставщиков для нескольких запросов сразу
  async getAllSupplierResponsesForRequests(requestIds: number[], userId?: number): Promise<SupplierResponse[]> {
    if (!requestIds.length) {
      return [];
    }
    
    console.log(`[storage] SECURITY: Fetching batch responses for ${requestIds.length} requests - userId provided: ${userId !== undefined}`);
    
    // CRITICAL SECURITY: Always require userId for data isolation
    if (userId === undefined) {
      console.error(`[storage] SECURITY VIOLATION: Attempted to fetch batch responses without user filter`);
      throw new Error("User ID is required for batch response access - security violation prevented");
    }
    
    // Build the query with both request IDs and user ID filters
    const conditions = and(
      inArray(supplierResponses.requestId, requestIds),
      eq(supplierResponses.userId, userId)
    );
    
    const results = await db
      .select({
        id: supplierResponses.id,
        requestId: supplierResponses.requestId,
        userId: supplierResponses.userId,
        supplierEmail: supplierResponses.supplierEmail,
        subject: supplierResponses.subject,
        content: supplierResponses.content,
        responseDate: supplierResponses.responseDate,
        isRead: supplierResponses.isRead,
        processingStatus: supplierResponses.processingStatus,
        processingStartedAt: supplierResponses.processingStartedAt,
        processingCompletedAt: supplierResponses.processingCompletedAt,
        processingError: supplierResponses.processingError,
        supplierId: supplierResponses.supplierId,
        supplierName: supplierResponses.supplierName,
        requestSupplierId: supplierResponses.requestSupplierId,
        isRepliedTo: supplierResponses.isRepliedTo,
        isFavorite: supplierResponses.isFavorite,
        messageId: supplierResponses.messageId,
        isAnalyzed: supplierResponses.isAnalyzed
        // НЕ включаем attachments - загружаем отдельно!
      })
      .from(supplierResponses)
      .where(conditions)
      .orderBy(desc(supplierResponses.responseDate));
      
    // Add empty attachments array - будет загружаться отдельно
    const processedResults = results.map(response => ({
      ...response,
      attachments: [] // Пустой массив - загружаем отдельно
    }));
    
    console.log(`[storage] SECURITY: Returning ${processedResults.length} batch responses exclusively for user ID: ${userId} (without attachments)`);
    
    return processedResults;
  }
  
  async countAllSupplierResponses(): Promise<number> {
    const result = await db
      .select({ count: count(supplierResponses.id) })
      .from(supplierResponses);
    return result[0]?.count || 0;
  }
  
  async getSupplierResponseById(id: number): Promise<SupplierResponse | undefined> {
    try {
      const [response] = await db
        .select()
        .from(supplierResponses)
        .where(eq(supplierResponses.id, id));
      return response;
    } catch (error) {
      console.error(`Error getting supplier response with ID ${id}:`, error);
      return undefined;
    }
  }

  async markSupplierResponseAsRead(id: number): Promise<SupplierResponse | undefined> {
    const [updatedResponse] = await db
      .update(supplierResponses)
      .set({ isRead: true })
      .where(eq(supplierResponses.id, id))
      .returning();
    return updatedResponse;
  }
  
  async toggleFavoriteResponse(id: number, userId?: number): Promise<SupplierResponse | undefined> {
    try {
      // Build the query condition to ensure data isolation
      let condition = userId 
        ? and(eq(supplierResponses.id, id), eq(supplierResponses.userId, userId))
        : eq(supplierResponses.id, id);
      
      // Get the current response state with proper user filter
      const [currentResponse] = await db
        .select()
        .from(supplierResponses)
        .where(condition);
        
      if (!currentResponse) {
        console.error(`Не найден ответ с ID ${id}${userId ? ` для пользователя ${userId}` : ''} для изменения статуса избранного`);
        return undefined;
      }
      
      // Toggle isFavorite state
      const newFavoriteState = !currentResponse.isFavorite;
      console.log(`Переключение статуса избранного для ответа ${id}: ${currentResponse.isFavorite} -> ${newFavoriteState}`);
      
      // Update the database record with the same condition to ensure data isolation
      const [updatedResponse] = await db
        .update(supplierResponses)
        .set({ isFavorite: newFavoriteState })
        .where(condition)
        .returning();
      
      return updatedResponse;
    } catch (error) {
      console.error(`Ошибка при изменении статуса избранного у ответа ${id}:`, error);
      return undefined;
    }
  }
  
  async updateSupplierResponse(id: number, updates: Partial<SupplierResponse>): Promise<SupplierResponse | undefined> {
    try {
      const [updatedResponse] = await db
        .update(supplierResponses)
        .set(updates)
        .where(eq(supplierResponses.id, id))
        .returning();
      return updatedResponse;
    } catch (error) {
      console.error(`Error updating supplier response with ID ${id}:`, error);
      return undefined;
    }
  }

  // Analysis results operations
  async createAnalysisResult(result: InsertAnalysisResult): Promise<AnalysisResult> {
    console.log(`[storage] Creating analysis result for request ID ${result.requestId} with userId=${result.userId || 'NULL'}`);
    
    // If userId is not provided, try to get it from the search request
    if (!result.userId) {
      console.log(`[storage] Trying to retrieve userId from search request ${result.requestId}`);
      try {
        const [searchRequest] = await db
          .select()
          .from(searchRequests)
          .where(eq(searchRequests.id, result.requestId));
          
        if (searchRequest && searchRequest.userId) {
          result.userId = searchRequest.userId;
          console.log(`[storage] Retrieved userId ${result.userId} from search request ${result.requestId}`);
        } else {
          console.warn(`[storage] WARNING: Could not find userId for request ${result.requestId}`);
        }
      } catch (err) {
        console.error(`[storage] Error retrieving userId from search request:`, err);
      }
    }
    
    // Still no userId? Log a critical warning
    if (!result.userId) {
      console.warn(`[storage] CRITICAL: Creating analysis result without userId! This breaks multi-tenant isolation.`);
    }
    
    const [analysisResult] = await db
      .insert(analysisResults)
      .values(result)
      .returning();
    
    return analysisResult;
  }

  async getAnalysisResults(requestId: number): Promise<AnalysisResult[]> {
    return await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.requestId, requestId))
      .orderBy(desc(analysisResults.dateCreated));
  }

  async getAnalysisResultById(id: number): Promise<AnalysisResult | undefined> {
    const [result] = await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.id, id));
    return result;
  }

  // Helper functions
  generateOrderNumber(): string {
    // Format: REQ-YYMM-XXXXX (Year-Month-Random)
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `REQ-${year}${month}-${random}`;
  }

  // Temporarily removed buyer field handling

  generateTrackingId(): string {
    // Using nanoid to generate a unique, URL-friendly ID
    return nanoid(10); // 10 characters is sufficient for our needs
  }

  async getPendingSearchRequests(): Promise<SearchRequest[]> {
    return await db
      .select()
      .from(searchRequests)
      .where(eq(searchRequests.status, 'pending'))
      .orderBy(desc(searchRequests.createdAt));
  }

  async initializeSampleData() {
    const existingSuppliers = await this.getSuppliers();
    if (existingSuppliers.length === 0) {
      await db.insert(suppliers).values([
        {
          name: "TechPro Solutions",
          description: "Leading manufacturer of electronic components, circuits, and industrial hardware. We specialize in custom manufacturing and assembly. Products include headphones, speakers, and audio equipment.",
          website: "https://techpro.example.com",
          email: "info@techpro.example.com",
          phone: "+1-555-0123",
          categories: ["electronics", "manufacturing", "hardware", "audio equipment", "headphones", "consumer electronics"],
        },
        {
          name: "Global Materials Inc",
          description: "Raw materials and industrial supplies provider specializing in metals, plastics, and composite materials. We offer packaging solutions including carton boxes, shipping containers, and protective materials.",
          website: "https://globalmaterials.example.com",
          email: "sales@globalmaterials.example.com",
          phone: "+1-555-0124",
          categories: ["raw materials", "industrial", "packaging", "carton boxes", "shipping supplies"],
        },
        {
          name: "SmartTech Manufacturing",
          description: "Innovative electronics and smart device manufacturer. Specializing in IoT components, consumer electronics, and audio devices including wireless headphones and earbuds.",
          website: "https://smarttech.example.com",
          email: "contact@smarttech.example.com",
          phone: "+1-555-0125",
          categories: ["electronics", "smart devices", "consumer products", "headphones", "audio"],
        },
        {
          name: "PackMaster Solutions",
          description: "Comprehensive packaging solutions provider. We manufacture and supply all types of packaging materials including carton boxes, corrugated boxes, custom packaging, and eco-friendly options.",
          website: "https://packmaster.example.com",
          email: "sales@packmaster.example.com",
          phone: "+1-555-0126",
          categories: ["packaging", "carton boxes", "shipping supplies", "eco-friendly"],
        }
      ]);
    }
  }

  // Contact group operations
  async createContactGroup(group: InsertContactGroup): Promise<ContactGroup> {
    const [newGroup] = await db
      .insert(contactGroups)
      .values({
        ...group,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newGroup;
  }

  async getContactGroups(userId?: number): Promise<ContactGroup[]> {
    console.log(`[storage] SECURITY: Fetching contact groups - userId provided: ${userId !== undefined}`);
    
    // CRITICAL SECURITY: Always require userId for data isolation
    if (userId === undefined) {
      console.error(`[storage] SECURITY VIOLATION: Attempted to fetch contact groups without user filter`);
      throw new Error("User ID is required for contact group access - security violation prevented");
    }
    
    // Execute the query with user filtering and ordering
    const groups = await db
      .select()
      .from(contactGroups)
      .where(eq(contactGroups.userId, userId))
      .orderBy(desc(contactGroups.createdAt));
      
    // For each group, get the count of contacts (both direct contacts and suppliers in groups)
    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        // Count direct contact items
        const [directContactsResult] = await db
          .select({ count: count() })
          .from(contactItems)
          .where(eq(contactItems.groupId, group.id));
          
        const directContacts = directContactsResult?.count || 0;
        
        // Count suppliers in groups
        const [supplierGroupsResult] = await db
          .select({ count: count() })
          .from(requestSupplierGroups)
          .where(eq(requestSupplierGroups.contactGroupId, group.id));
          
        const suppliersInGroup = supplierGroupsResult?.count || 0;
        
        // Sum both types of contacts
        const totalContacts = Number(directContacts) + Number(suppliersInGroup);
        
        return {
          ...group,
          contactCount: totalContacts
        };
      })
    );
    
    return groupsWithCounts;
  }

  async getContactGroupById(id: number, userId?: number): Promise<ContactGroup | undefined> {
    // Build the query conditions
    let conditions = userId 
      ? and(eq(contactGroups.id, id), eq(contactGroups.userId, userId))
      : eq(contactGroups.id, id);
    
    const [group] = await db
      .select()
      .from(contactGroups)
      .where(conditions);
    
    if (!group) return undefined;
    
    // Count direct contact items with userId filtering if provided
    let contactItemsCondition = userId 
      ? and(eq(contactItems.groupId, id), eq(contactItems.userId, userId))
      : eq(contactItems.groupId, id);
    
    const [directContactsResult] = await db
      .select({ count: count() })
      .from(contactItems)
      .where(contactItemsCondition);
      
    const directContacts = directContactsResult?.count || 0;
    
    // Count suppliers in groups with userId filtering if provided
    let supplierGroupsCondition = userId 
      ? and(eq(requestSupplierGroups.contactGroupId, id), eq(requestSupplierGroups.userId, userId))
      : eq(requestSupplierGroups.contactGroupId, id);
    
    const [supplierGroupsResult] = await db
      .select({ count: count() })
      .from(requestSupplierGroups)
      .where(supplierGroupsCondition);
      
    const suppliersInGroup = supplierGroupsResult?.count || 0;
    
    // Sum both types of contacts
    const totalContacts = Number(directContacts) + Number(suppliersInGroup);
    
    return {
      ...group,
      contactCount: totalContacts
    };
  }

  async updateContactGroup(id: number, group: Partial<InsertContactGroup>): Promise<ContactGroup | undefined> {
    const [updatedGroup] = await db
      .update(contactGroups)
      .set({
        ...group,
        updatedAt: new Date()
      })
      .where(eq(contactGroups.id, id))
      .returning();
    return updatedGroup;
  }

  async deleteContactGroup(id: number): Promise<boolean> {
    try {
      // First delete all contact items in this group
      await db
        .delete(contactItems)
        .where(eq(contactItems.groupId, id));

      // Then delete any request supplier relationships
      await db
        .delete(requestSupplierGroups)
        .where(eq(requestSupplierGroups.contactGroupId, id));

      // Finally delete the group itself
      const result = await db
        .delete(contactGroups)
        .where(eq(contactGroups.id, id));

      // Safely check for rowCount, which might be null in some circumstances
      return result && typeof result.rowCount === 'number' && result.rowCount > 0;
    } catch (error) {
      console.error(`Error deleting contact group ${id}:`, error);
      return false;
    }
  }

  // Contact item operations
  async createContactItem(item: InsertContactItem): Promise<ContactItem> {
    try {
      // Проверяем, существует ли уже контакт с таким email в этой группе
      // Добавляем проверку userId для правильной изоляции данных
      let query = and(
        eq(contactItems.groupId, item.groupId),
        eq(contactItems.email, item.email)
      );
      
      // Если передан userId, добавляем его в условие для изоляции данных
      if (item.userId) {
        query = and(query, eq(contactItems.userId, item.userId));
      }
      
      const existingContacts = await db
        .select()
        .from(contactItems)
        .where(query);
      
      // Если контакт с таким email уже существует в группе, возвращаем его
      if (existingContacts && existingContacts.length > 0) {
        console.log(`Контакт с email ${item.email} уже существует в группе ${item.groupId} для пользователя ${item.userId || 'любого'}, пропускаем дублирование`);
        return existingContacts[0];
      }
      
      // Если контакта нет, создаем новый
      const [newItem] = await db
        .insert(contactItems)
        .values({
          ...item,
          createdAt: new Date()
        })
        .returning();
        
      console.log(`Создан новый контакт: ${newItem.email} в группе ${newItem.groupId} для пользователя ${newItem.userId || 'не указан'}`);
      return newItem;
    } catch (error) {
      console.error(`Ошибка при создании контакта ${item.email} в группе ${item.groupId}:`, error);
      // В случае ошибки все равно пытаемся вставить, если это не дубликат
      const [newItem] = await db
        .insert(contactItems)
        .values({
          ...item,
          createdAt: new Date()
        })
        .returning();
      return newItem;
    }
  }

  async getContactItemsByGroupId(groupId: number, userId?: number): Promise<ContactItem[]> {
    try {
      console.log(`Запрос контактов для группы ${groupId}${userId ? ` и пользователя ${userId}` : ''}`);
      
      // Строим базовое условие - обязательно группа должна совпадать
      let conditions = eq(contactItems.groupId, groupId);
      
      // Если передан userId, добавляем его в условие для изоляции данных, включая legacy контакты
      if (userId) {
        // Поддерживаем legacy контакты (с null userId) и контакты текущего пользователя
        // Это важно для обратной совместимости и корректной работы с существующими данными
        conditions = and(
          conditions, 
          or(
            eq(contactItems.userId, userId),
            isNull(contactItems.userId)
          )
        );
        console.log(`Применяем фильтрацию по userId=${userId} для группы ${groupId} с поддержкой legacy контактов`);
      }
      
      // Выполнение запроса с сортировкой
      const items = await db
        .select()
        .from(contactItems)
        .where(conditions)
        .orderBy(desc(contactItems.createdAt));
      
      console.log(`Найдено ${items.length} контактов для группы ${groupId} пользователя ${userId || 'не указан'}`);
      
      // Возвращаем контакты
      return items;
      
    } catch (error) {
      console.error(`Error fetching contact items for group ${groupId}${userId ? ` and user ${userId}` : ''}:`, error);
      return []; // В случае ошибки возвращаем пустой массив для безопасности
    }
  }

  // ОПТИМИЗАЦИЯ: Получаем количество контактов для всех групп одним запросом
  async getContactCountsByGroupIds(groupIds: number[], userId?: number): Promise<Record<number, number>> {
    try {
      console.log(`[OPTIMIZE] Получение количества контактов для ${groupIds.length} групп одним запросом`);
      
      // Строим условие для фильтрации по группам
      let conditions = inArray(contactItems.groupId, groupIds);
      
      // Если передан userId, добавляем его в условие для изоляции данных
      if (userId) {
        conditions = and(
          conditions,
          or(
            eq(contactItems.userId, userId),
            isNull(contactItems.userId)
          )
        );
      }

      // Выполняем группировку и подсчет одним запросом
      const results = await db
        .select({
          groupId: contactItems.groupId,
          count: count()
        })
        .from(contactItems)
        .where(conditions)
        .groupBy(contactItems.groupId);

      // Преобразуем результат в объект для быстрого поиска
      const countMap: Record<number, number> = {};
      results.forEach(result => {
        countMap[result.groupId] = result.count;
      });

      console.log(`[OPTIMIZE] Получено количество контактов для ${results.length} групп:`, countMap);
      
      return countMap;
    } catch (error) {
      console.error("Ошибка получения количества контактов для групп:", error);
      throw error;
    }
  }
  
  async getContactItemsByEmail(groupId: number, email: string, userId?: number): Promise<ContactItem[]> {
    try {
      console.log(`Поиск контакта с email ${email} в группе ${groupId}${userId ? ` для пользователя ${userId}` : ''}`);
      
      // Начинаем с базовых условий
      let conditions = and(
        eq(contactItems.groupId, groupId),
        eq(contactItems.email, email)
      );
      
      // Добавляем фильтрацию по userId, если он указан для изоляции данных
      if (userId) {
        // ИСПРАВЛЕНИЕ: Используем ту же логику фильтрации что и в getContactItemsByGroupId
        // Поддерживаем legacy контакты (с null userId) и контакты текущего пользователя
        conditions = and(
          conditions,
          or(
            eq(contactItems.userId, userId),
            isNull(contactItems.userId)
          )
        );
        console.log(`Применяем гибкую фильтрацию по userId=${userId} для email=${email} в группе ${groupId} с поддержкой legacy контактов`);
      }
      
      const items = await db
        .select()
        .from(contactItems)
        .where(conditions);
      
      console.log(`Найдено ${items.length} контактов с email ${email} в группе ${groupId} пользователя ${userId || 'не указан'}`);
      
      // Возвращаем контакты без лишних полей
      return items;
    } catch (error) {
      console.error(`Ошибка при поиске контакта с email ${email} в группе ${groupId}${userId ? ` для пользователя ${userId}` : ''}:`, error);
      return [];
    }
  }
  
  async getContactById(contactId: number): Promise<ContactItem | null> {
    try {
      console.log(`Получение контакта с ID ${contactId}`);
      const [contact] = await db
        .select()
        .from(contactItems)
        .where(eq(contactItems.id, contactId));
      
      if (!contact) {
        console.log(`Контакт с ID ${contactId} не найден`);
        return null;
      }
      
      // Возвращаем контакт как есть
      return contact;
    } catch (error) {
      console.error(`Error retrieving contact by ID ${contactId}:`, error);
      return null;
    }
  }

  async updateContactItem(id: number, item: Partial<InsertContactItem>): Promise<ContactItem | undefined> {
    try {
      console.log(`Обновление контакта с ID ${id}:`, item);
      
      const [updatedItem] = await db
        .update(contactItems)
        .set(item)
        .where(eq(contactItems.id, id))
        .returning();
      
      console.log(`Контакт с ID ${id} успешно обновлен:`, updatedItem);
      return updatedItem;
    } catch (error) {
      console.error(`Ошибка обновления контакта с ID ${id}:`, error);
      return undefined;
    }
  }

  async deleteContactItem(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(contactItems)
        .where(eq(contactItems.id, id));
      
      // Safely check for rowCount, which might be null in some circumstances
      return result && typeof result.rowCount === 'number' && result.rowCount > 0;
    } catch (error) {
      console.error(`Error deleting contact item ${id}:`, error);
      return false;
    }
  }

  // Get contacts by email for comparison purposes
  async getContactsByEmail(email: string, userId?: number): Promise<ContactItem[]> {
    try {
      let query = eq(contactItems.email, email);
      
      // Add user isolation if userId is provided
      if (userId) {
        query = and(query, eq(contactItems.userId, userId));
      }
      
      const contacts = await db
        .select()
        .from(contactItems)
        .where(query);
      
      return contacts;
    } catch (error) {
      console.error(`Error getting contacts by email ${email}:`, error);
      return [];
    }
  }

  // Добавление массива контактов в группу
  async addContactsToGroup(groupId: number, contacts: Array<Partial<InsertContactItem>>, userId?: number): Promise<ContactItem[]> {
    console.log(`addContactsToGroup: Adding ${contacts.length} contacts to group ${groupId} for user ${userId || 'unknown'}`);
    
    try {
      // Проверяем существование группы с проверкой userId для изоляции данных
      const group = await this.getContactGroupById(groupId, userId);
      if (!group) {
        console.error(`Group with ID ${groupId} not found for user ${userId || 'unknown'}`);
        throw new Error(`Group with ID ${groupId} not found`);
      }
      
      // Используем userId из группы, если он не указан явно
      const actualUserId = userId || group.userId;
      
      console.log(`Using userId=${actualUserId} for adding contacts to group ${groupId}`);
      
      // Подготавливаем контакты к вставке,
      // убеждаемся, что у каждого контакта есть все необходимые поля
      // включая userId для изоляции данных между аккаунтами
      const contactsToInsert = contacts.map(contact => ({
        groupId: groupId,
        userId: actualUserId, // Всегда используем userId для правильной изоляции данных
        email: contact.email || '',
        name: contact.name || null,
        phone: contact.phone || null,
        organization: contact.organization || null
      }));
      
      // Вставляем контакты в базу данных
      const insertedContacts = await db
        .insert(contactItems)
        .values(contactsToInsert)
        .returning();
      
      console.log(`Successfully added ${insertedContacts.length} contacts to group ${groupId}`);
      
      // Обновляем счетчик контактов в группе
      const contactCount = await db
        .select({ count: count() })
        .from(contactItems)
        .where(eq(contactItems.groupId, groupId));
      
      const newCount = contactCount[0]?.count || 0;
      
      // Обновляем группу с новым количеством контактов
      await db
        .update(contactGroups)
        .set({ contactCount: newCount })
        .where(eq(contactGroups.id, groupId));
      
      return insertedContacts;
    } catch (error) {
      console.error(`Error adding contacts to group ${groupId}:`, error);
      throw error;
    }
  }

  // Email request operations
  async createEmailRequest(request: InsertEmailRequest): Promise<EmailRequest> {
    const [emailRequest] = await db
      .insert(emailRequests)
      .values(request)
      .returning();
    return emailRequest;
  }
  
  async getEmailRequestById(id: number): Promise<EmailRequest | undefined> {
    try {
      const [emailRequest] = await db
        .select()
        .from(emailRequests)
        .where(eq(emailRequests.id, id));
      return emailRequest;
    } catch (error) {
      console.error(`Error fetching email request with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async getEmailRequestsByGroupId(groupId: number): Promise<EmailRequest[]> {
    try {
      return await db
        .select()
        .from(emailRequests)
        .where(eq(emailRequests.groupId, groupId))
        .orderBy(desc(emailRequests.createdAt));
    } catch (error) {
      console.error(`Error fetching email requests for group ${groupId}:`, error);
      // Return empty array if table doesn't exist yet
      return [];
    }
  }
  
  async updateEmailRequestStatus(id: number, status: string): Promise<EmailRequest | undefined> {
    try {
      const [updatedRequest] = await db
        .update(emailRequests)
        .set({ status })
        .where(eq(emailRequests.id, id))
        .returning();
      return updatedRequest;
    } catch (error) {
      console.error(`Error updating email request status for ID ${id}:`, error);
      return undefined;
    }
  }

  // Request supplier to contact group operations
  async addSupplierToContactGroup(data: InsertRequestSupplierGroup): Promise<RequestSupplierGroup> {
    try {
      // Проверяем, существует ли уже поставщик в этой группе
      const existingRelations = await db
        .select()
        .from(requestSupplierGroups)
        .where(
          and(
            eq(requestSupplierGroups.requestSupplierId, data.requestSupplierId),
            eq(requestSupplierGroups.contactGroupId, data.contactGroupId)
          )
        );
      
      // Если связь уже существует, возвращаем её
      if (existingRelations && existingRelations.length > 0) {
        console.log(`Поставщик ${data.requestSupplierId} уже существует в группе ${data.contactGroupId}, пропускаем дублирование`);
        return existingRelations[0];
      }
      
      // Если связи нет, создаём новую
      const [newRelation] = await db
        .insert(requestSupplierGroups)
        .values({
          ...data,
          addedAt: new Date()
        })
        .returning();
        
      console.log(`Поставщик ${data.requestSupplierId} добавлен в группу контактов ${data.contactGroupId}`);
      return newRelation;
    } catch (error) {
      console.error(`Error adding supplier ${data.requestSupplierId} to contact group ${data.contactGroupId}:`, error);
      // If there's an error, throw it so the API can return a proper error response
      throw error;
    }
  }

  async getContactGroupsByRequestSupplierId(requestSupplierId: number): Promise<ContactGroup[]> {
    // Join requestSupplierGroups with contactGroups to get all groups for a supplier
    const result = await db
      .select({
        id: contactGroups.id,
        name: contactGroups.name,
        description: contactGroups.description,
        contactCount: contactGroups.contactCount,
        userId: contactGroups.userId,
        createdAt: contactGroups.createdAt,
        updatedAt: contactGroups.updatedAt
      })
      .from(requestSupplierGroups)
      .innerJoin(
        contactGroups,
        eq(requestSupplierGroups.contactGroupId, contactGroups.id)
      )
      .where(eq(requestSupplierGroups.requestSupplierId, requestSupplierId));

    return result;
  }

  async removeSupplierFromContactGroup(requestSupplierId: number, contactGroupId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(requestSupplierGroups)
        .where(
          and(
            eq(requestSupplierGroups.requestSupplierId, requestSupplierId),
            eq(requestSupplierGroups.contactGroupId, contactGroupId)
          )
        );
      
      // Safely check for rowCount, which might be null in some circumstances
      return result && typeof result.rowCount === 'number' && result.rowCount > 0;
    } catch (error) {
      console.error(`Error removing supplier ${requestSupplierId} from contact group ${contactGroupId}:`, error);
      return false;
    }
  }

  // Implementation for getSupplierGroups
  async getSupplierGroups(supplierId: number): Promise<number[]> {
    try {
      // First check if this is a database supplier
      const supplier = await this.getSupplier(supplierId);
      
      if (supplier) {
        // Direct database supplier - check if there are any requestSupplier records for this supplier
        const supplierRecords = await db
          .select()
          .from(requestSuppliers)
          .where(eq(requestSuppliers.supplierId, supplierId.toString()));
        
        if (supplierRecords.length > 0) {
          // Use the first requestSupplier record to get groups
          const requestSupplierId = supplierRecords[0].id;
          const groups = await this.getContactGroupsByRequestSupplierId(requestSupplierId);
          return groups.map(group => group.id);
        }
        
        return [];
      } else {
        // This might be a requestSupplier ID directly
        // Get all groups this requestSupplier belongs to
        const groups = await this.getContactGroupsByRequestSupplierId(supplierId);
        return groups.map(group => group.id);
      }
    } catch (error) {
      console.error(`Error getting groups for supplier ${supplierId}:`, error);
      return [];
    }
  }

  // Implementation for updateSupplierGroups
  async updateSupplierGroups(supplierId: number, groupIds: number[]): Promise<{ success: boolean }> {
    try {
      // Проверим, если это API-поставщик (с отрицательным ID)
      const isApiSupplier = supplierId < 0;
      
      let requestSupplierId: number;
      
      if (isApiSupplier) {
        // Для API-поставщиков требуется сначала создать запись в таблице requestSuppliers
        // Проверим, есть ли уже такая запись
        const supplierIdStr = `api-${Math.abs(supplierId)}`;
        const existingRecords = await db
          .select()
          .from(requestSuppliers)
          .where(eq(requestSuppliers.supplierId, supplierIdStr));
          
        if (existingRecords.length > 0) {
          // Используем существующую запись
          requestSupplierId = existingRecords[0].id;
        } else {
          // Найдем существующий запрос для использования в качестве привязки
          // Нам нужен валидный ID запроса, т.к. в базе есть ограничение внешнего ключа
          const existingRequests = await db
            .select()
            .from(searchRequests)
            .limit(1);
            
          if (existingRequests.length === 0) {
            throw new Error("Не найдено ни одного запроса для привязки поставщика. Создайте хотя бы один запрос.");
          }
          
          const validRequestId = existingRequests[0].id;
          const trackingId = this.generateTrackingId();
          
          try {
            console.log(`Создание временной записи requestSupplier для API-поставщика ${supplierId} с requestId=${validRequestId}`);
            
            const [createdRecord] = await db
              .insert(requestSuppliers)
              .values({
                requestId: validRequestId, // Используем существующий запрос вместо фейкового ID
                supplierId: supplierIdStr, // Already converted to positive string format "api-XXXX"
                supplierName: `API Supplier ${Math.abs(supplierId)}`,
                supplierEmail: "placeholder@example.com",
                trackingId: trackingId,
                emailSubject: "Temporary record",
                emailContent: "This is a temporary record for API supplier",
                hasResponded: false
              })
              .returning();
              
            requestSupplierId = createdRecord.id;
            console.log(`Создана запись requestSupplier с ID=${requestSupplierId} для API-поставщика ${supplierId}`);
          } catch (dbError) {
            console.error(`Ошибка при создании записи requestSupplier для API-поставщика ${supplierId}:`, dbError);
            throw dbError;
          }
        }
      } else {
        // Обработка поставщиков из базы данных (положительный ID)
        const supplier = await this.getSupplier(supplierId);
        
        if (supplier) {
          // Проверяем, есть ли записи requestSupplier для этого поставщика
          const supplierRecords = await db
            .select()
            .from(requestSuppliers)
            .where(eq(requestSuppliers.supplierId, supplierId.toString()));
          
          if (supplierRecords.length > 0) {
            // Используем первую запись requestSupplier для обновления групп
            requestSupplierId = supplierRecords[0].id;
          } else {
            // Нет записи requestSupplier для этого поставщика
            // Создадим временную запись, используя существующий запрос
            // Найдем существующий запрос для использования в качестве привязки
            const existingRequests = await db
              .select()
              .from(searchRequests)
              .limit(1);
              
            if (existingRequests.length === 0) {
              throw new Error("Не найдено ни одного запроса для привязки поставщика. Создайте хотя бы один запрос.");
            }
            
            const validRequestId = existingRequests[0].id;
            const trackingId = this.generateTrackingId();
            
            console.log(`Создание временной записи requestSupplier для поставщика ${supplierId} с requestId=${validRequestId}`);
            
            let createdRecordId: number;
            try {
              const [createdRecord] = await db
                .insert(requestSuppliers)
                .values({
                  requestId: validRequestId, // Используем существующий запрос вместо фейкового ID
                  supplierId: supplierId.toString(),
                  supplierName: supplier.name || `Supplier ${supplierId}`,
                  supplierEmail: supplier.email || "placeholder@example.com",
                  trackingId: trackingId,
                  emailSubject: "Temporary record",
                  emailContent: "This is a temporary record for database supplier",
                  hasResponded: false
                })
                .returning();
                
              createdRecordId = createdRecord.id;
              console.log(`Создана запись requestSupplier с ID=${createdRecordId} для поставщика ${supplierId}`);
            } catch (dbError) {
              console.error(`Ошибка при создании записи requestSupplier для поставщика ${supplierId}:`, dbError);
              throw dbError;
            }
              
            requestSupplierId = createdRecordId;
          }
        } else {
          // Поставщик не найден
          return { success: false };
        }
      }
      
      // Получим текущие группы для этого поставщика
      const currentGroups = await this.getContactGroupsByRequestSupplierId(requestSupplierId);
      const currentGroupIds = currentGroups.map(group => group.id);
      
      // Группы для добавления (в groupIds, но не в currentGroupIds)
      const groupsToAdd = groupIds.filter(id => !currentGroupIds.includes(id));
      
      // Группы для удаления (в currentGroupIds, но не в groupIds)
      const groupsToRemove = currentGroupIds.filter(id => !groupIds.includes(id));
      
      // Добавляем поставщика в новые группы
      for (const groupId of groupsToAdd) {
        await this.addSupplierToContactGroup({
          requestSupplierId,
          contactGroupId: groupId
        });
      }
      
      // Удаляем поставщика из групп, которых нет в новом списке
      for (const groupId of groupsToRemove) {
        await this.removeSupplierFromContactGroup(requestSupplierId, groupId);
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error updating groups for supplier ${supplierId}:`, error);
      return { success: false };
    }
  }
  
  // Supplier message operations
  async getSupplierMessageById(id: number): Promise<SupplierMessage | undefined> {
    try {
      console.log(`[storage] Getting supplier message with ID: ${id}`);
      
      // First try looking up by message ID
      const [message] = await db
        .select()
        .from(requestSupplierMessages)
        .where(eq(requestSupplierMessages.id, id));
      
      if (message) {
        console.log(`[storage] Found supplier message. Has attachments: ${message.attachments ? (Array.isArray(message.attachments) ? message.attachments.length : 'Yes (not array)') : 'No'}`);
        
        // Ensure attachments is an array if it exists
        if (message.attachments) {
          console.log(`[storage] Processing attachments for message ${id}`);
          
          // Convert to array if not already
          let attachmentsArray = Array.isArray(message.attachments) 
            ? message.attachments 
            : (typeof message.attachments === 'string' 
                ? (message.attachments.startsWith('[') ? JSON.parse(message.attachments) : [message.attachments])
                : [message.attachments]);
          
          // Process each attachment to ensure it has proper format and properties
          message.attachments = attachmentsArray.map((att: any, index: number) => {
            // Skip if null or undefined
            if (!att) return null;
            
            // Normalize attachment properties
            const attachment = {
              filename: att.filename || `file-${index}.bin`,
              contentType: att.contentType || 'application/octet-stream',
              content: att.content || '',
              encoding: att.encoding || 'base64',
              size: att.size || (att.content ? (typeof att.content === 'string' ? att.content.length : 0) : 0)
            };
            
            console.log(`[storage] Processed attachment ${index}: ${attachment.filename}, type: ${attachment.contentType}, size: ${attachment.size}`);
            
            return attachment;
          }).filter(Boolean); // Remove null entries
        } else {
          message.attachments = [];
        }
        
        return message as SupplierMessage;
      }
      
      console.log(`[storage] Message not found by ID ${id}, trying alternative methods`);
      
      // If not found, try looking up in supplier responses (for compatibility)
      const [response] = await db
        .select()
        .from(supplierResponses)
        .where(eq(supplierResponses.id, id));
        
      if (response) {
        console.log(`[storage] Found supplier response instead of message`);
        // Convert supplier response to message format
        const message: SupplierMessage = {
          id: response.id,
          requestSupplierId: response.requestSupplierId || 0,
          content: response.content || '',
          subject: response.subject || '',
          direction: 'inbound',
          sentDate: response.responseDate || new Date(),
          attachments: response.attachments || []
        };
        return message;
      }
      
      console.log(`[storage] No supplier message or response found with ID ${id}`);
      return undefined;
    } catch (error) {
      console.error(`[storage] Error getting supplier message with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async getSupplierMessages(requestSupplierId: number, userId?: number): Promise<SupplierMessage[]> {
    try {
      console.log(`[storage] Fetching messages for requestSupplierId ${requestSupplierId}${userId ? ` and userId ${userId}` : ''}`);
      
      // Проверяем, есть ли такой requestSupplier и принадлежит ли он указанному пользователю
      const requestSupplierQuery = db
        .select()
        .from(requestSuppliers)
        .where(eq(requestSuppliers.id, requestSupplierId))
        .limit(1);
      
      // Если передан userId, добавляем проверку на принадлежность поставщика пользователю
      if (userId) {
        // Для проверки связи с userId, нам нужно joined query через searchRequests
        const requestSupplierWithUser = await db
          .select({
            id: requestSuppliers.id,
            userId: searchRequests.userId
          })
          .from(requestSuppliers)
          .innerJoin(searchRequests, eq(requestSuppliers.requestId, searchRequests.id))
          .where(and(
            eq(requestSuppliers.id, requestSupplierId),
            eq(searchRequests.userId, userId)
          ))
          .limit(1);
        
        if (requestSupplierWithUser.length === 0) {
          console.warn(`[storage] No request supplier found with ID ${requestSupplierId} for user ${userId} or user doesn't have access`);
          return [];
        }
      } else {
        // Если userId не передан, проверяем только существование requestSupplier
        const requestSupplier = await requestSupplierQuery;
        if (requestSupplier.length === 0) {
          console.warn(`[storage] No request supplier found with ID ${requestSupplierId}`);
          return [];
        }
      }
      
      // Получаем сообщения
      let messageQuery = db
        .select()
        .from(requestSupplierMessages)
        .where(eq(requestSupplierMessages.requestSupplierId, requestSupplierId));
      
      // Если userId передан, добавляем условие фильтрации по userId
      // Но также включаем сообщения с userId = null, так как они могут быть системными
      if (userId) {
        messageQuery = messageQuery.where(
          or(
            eq(requestSupplierMessages.userId, userId),
            isNull(requestSupplierMessages.userId)
          )
        );
      }
      
      const messages = await messageQuery.orderBy(desc(requestSupplierMessages.sentDate));
      
      console.log(`[storage] Found ${messages.length} messages for requestSupplierId ${requestSupplierId}${userId ? ` and userId ${userId}` : ''}`);
      
      // Возвращаем сообщения как есть
      return messages as SupplierMessage[];
    } catch (error) {
      console.error(`[storage] Error getting supplier messages for requestSupplierId ${requestSupplierId}:`, error);
      return [];
    }
  }
  
  async addSupplierMessage(message: InsertSupplierMessage): Promise<SupplierMessage> {
    try {
      console.log(`[storage] Adding new message for requestSupplierId ${message.requestSupplierId}`, {
        direction: message.direction,
        hasContent: !!message.content,
        contentLength: message.content ? message.content.length : 0,
        hasAttachments: message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0,
        userId: message.userId || 'NULL'
      });
      
      // Проверяем существование requestSupplierId
      const requestSupplier = await db
        .select()
        .from(requestSuppliers)
        .where(eq(requestSuppliers.id, message.requestSupplierId))
        .limit(1);
      
      if (requestSupplier.length === 0) {
        console.error(`[storage] Cannot add message: requestSupplier with ID ${message.requestSupplierId} not found`);
        throw new Error(`RequestSupplier with ID ${message.requestSupplierId} not found`);
      }
      
      // Get the search request to retrieve the user ID if not provided
      if (!message.userId && requestSupplier[0].requestId) {
        console.log(`[storage] Trying to retrieve userId from search request ${requestSupplier[0].requestId}`);
        const [searchRequest] = await db
          .select()
          .from(searchRequests)
          .where(eq(searchRequests.id, requestSupplier[0].requestId));
          
        if (searchRequest && searchRequest.userId) {
          message.userId = searchRequest.userId;
          console.log(`[storage] Retrieved userId ${message.userId} from search request ${searchRequest.id}`);
        } else {
          console.warn(`[storage] WARNING: Could not find userId for request ${requestSupplier[0].requestId}`);
        }
      }
      
      // Создаем объект с данными, исключая поле subject, которого нет в базе данных
      const messageData = {
        requestSupplierId: message.requestSupplierId,
        content: message.content,
        direction: message.direction,
        sentDate: message.sentDate,
        attachments: message.attachments || [],
        userId: message.userId // Include userId for multi-tenant isolation
      };
      
      // Log warning if still no userId
      if (!messageData.userId) {
        console.warn(`[storage] WARNING: Creating supplier message without userId! This breaks multi-tenant isolation.`);
      }
      
      // Используем прямую схему с исправленными полями
      const [newMessage] = await db
        .insert(requestSupplierMessages)
        .values(messageData)
        .returning();
      
      console.log(`[storage] Successfully saved message with ID ${newMessage.id} for userId=${messageData.userId || 'NULL'}`);
      
      // Возвращаем сообщение как есть, без преобразования
      return newMessage as SupplierMessage;
    } catch (error) {
      console.error('[storage] Error adding supplier message:', error);
      throw error;
    }
  }
  
  // Search request operations

  // REMOVED: Insecure method that fetches all requests without user filtering
  // This method was a security vulnerability - replaced with user-filtered version only
  
  // Parameter operations
  async getParametersForRequest(requestId: number): Promise<RequestParameter | undefined> {
    try {
      console.log(`[storage] Getting parameters for request ID ${requestId}`);
      const parameters = await db
        .select()
        .from(requestParameters)
        .where(eq(requestParameters.requestId, requestId))
        .orderBy(desc(requestParameters.updatedAt));
      
      if (parameters.length === 0) {
        console.log(`[storage] No parameters found for request ID ${requestId}`);
        return undefined;
      }
      
      console.log(`[storage] Found ${parameters.length} parameter entries for request ID ${requestId}, using most recent`);
      return parameters[0];
    } catch (error) {
      console.error(`[storage] Error getting parameters for request ID ${requestId}:`, error);
      throw error;
    }
  }
  
  /**
   * Save parameters for a specific request, ensuring proper multi-tenant isolation with userId
   * @param requestId The ID of the request
   * @param parameters The parameters to save (array format)
   * @param userId The user ID for multi-tenant isolation (optional but recommended)
   * @returns The saved parameters
   */
  async saveParametersForRequest(requestId: number, parameters: any, userId?: number | null): Promise<RequestParameter> {
    try {
      console.log(`[ROOT_CAUSE_DEBUG] saveParametersForRequest called with requestId: ${requestId} (type: ${typeof requestId})`);
      console.log(`[ROOT_CAUSE_DEBUG] Call stack:`, new Error().stack?.split('\n').slice(1, 5));
      
      // If userId is not provided, try to get it from the search request
      if (!userId) {
        console.log(`[storage] Trying to retrieve userId from search request ${requestId}`);
        try {
          const [searchRequest] = await db
            .select()
            .from(searchRequests)
            .where(eq(searchRequests.id, requestId));
            
          if (searchRequest && searchRequest.userId) {
            userId = searchRequest.userId;
            console.log(`[storage] Retrieved userId ${userId} from search request ${requestId}`);
          }
        } catch (err) {
          console.error(`[storage] Error retrieving userId from search request:`, err);
        }
      }
      
      // Still no userId? Log a warning
      if (!userId) {
        console.warn(`[storage] WARNING: Saving parameters without userId for request ${requestId}! This breaks multi-tenant isolation.`);
      }
      
      // Check if parameters already exist for this request
      const existingParams = await db
        .select()
        .from(requestParameters)
        .where(eq(requestParameters.requestId, requestId));
      
      if (existingParams.length > 0) {
        // Update existing parameters
        console.log(`[storage] Updating existing parameters for request ID ${requestId}`);
        
        // Prepare update data
        const updateData: any = {
          parameters: parameters,
          updatedAt: new Date()
        };
        
        // If we have a userId and the existing record doesn't, update it
        if (userId && !existingParams[0].userId) {
          console.log(`[storage] Adding userId=${userId} to existing parameters for request ID ${requestId}`);
          updateData.userId = userId;
        }
        
        const [updated] = await db
          .update(requestParameters)
          .set(updateData)
          .where(eq(requestParameters.id, existingParams[0].id))
          .returning();
        
        console.log(`[storage] Parameters successfully updated for request ID ${requestId}`);
        return updated;
      } else {
        // Create new parameters
        console.log(`[storage] Creating new parameters for request ID ${requestId} with userId=${userId || 'null'}`);
        const [newParams] = await db
          .insert(requestParameters)
          .values({
            requestId,
            userId: userId, // Include user ID for multi-tenant isolation
            parameters: parameters,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        console.log(`[storage] Parameters successfully created for request ID ${requestId}`);
        return newParams;
      }
    } catch (error) {
      console.error(`[storage] Error saving parameters for request ID ${requestId}:`, error);
      throw error;
    }
  }

  /**
   * Delete parameters for a specific request
   * @param requestId The ID of the request to delete parameters for
   * @returns True if parameters were deleted, false if no parameters were found
   */
  async deleteParametersForRequest(requestId: number): Promise<boolean> {
    try {
      console.log(`[storage] Deleting parameters for request ID ${requestId}`);
      
      const result = await db.delete(requestParameters)
        .where(eq(requestParameters.requestId, requestId));
      
      console.log(`[storage] Parameters deletion result for request ID ${requestId}:`, result);
      return true;
    } catch (error) {
      console.error(`[storage] Error deleting parameters for request ID ${requestId}:`, error);
      return false;
    }
  }

  /**
   * Save extracted parameters from a supplier response
   * @param parameters The extracted parameters to save
   * @returns The saved parameters
   */
  async saveExtractedParameters(parameters: InsertExtractedParameter): Promise<ExtractedParameter> {
    try {
      console.log(`[storage] Saving extracted parameters for response ID ${parameters.responseId} with userId=${parameters.userId || 'null'}`);
      
      // Check if parameters already exist for this response
      const existingParams = await db
        .select()
        .from(extractedParameters)
        .where(eq(extractedParameters.responseId, parameters.responseId))
        .limit(1);
      
      if (existingParams.length > 0) {
        // Update existing parameters
        console.log(`[storage] Updating existing parameters for response ID ${parameters.responseId}`);
        
        // Prepare update data
        const updateData: any = {
          parameters: parameters.parameters,
          lastUpdateDate: new Date(),
          status: parameters.status || 'completed',
          errorMessage: parameters.errorMessage
        };
        
        // If we have a userId and the existing record doesn't, update it
        if (parameters.userId && !existingParams[0].userId) {
          console.log(`[storage] Adding userId=${parameters.userId} to existing extracted parameters`);
          updateData.userId = parameters.userId;
        }
        
        const [updated] = await db
          .update(extractedParameters)
          .set(updateData)
          .where(eq(extractedParameters.responseId, parameters.responseId))
          .returning();
        
        // Mark response as analyzed
        await db
          .update(supplierResponses)
          .set({ isAnalyzed: true })
          .where(eq(supplierResponses.id, parameters.responseId));
        
        return updated as ExtractedParameter;
      } else {
        // Insert new parameters
        console.log(`[storage] Inserting new parameters for response ID ${parameters.responseId} with userId=${parameters.userId || 'null'}`);
        const [inserted] = await db
          .insert(extractedParameters)
          .values(parameters) // parameters object now includes userId from the request
          .returning();

        // Mark response as analyzed
        await db
          .update(supplierResponses)
          .set({ isAnalyzed: true })
          .where(eq(supplierResponses.id, parameters.responseId));
        
        return inserted as ExtractedParameter;
      }
    } catch (error) {
      console.error(`[storage] Error saving extracted parameters for response ID ${parameters.responseId}:`, error);
      throw error;
    }
  }

  /**
   * Get extracted parameters by response ID with multi-tenant isolation
   * @param responseId The ID of the response
   * @param userId Optional user ID for multi-tenant isolation
   * @returns The extracted parameters or undefined if not found
   */
  async getExtractedParametersByResponseId(responseId: number, userId?: number): Promise<ExtractedParameter | undefined> {
    try {
      // Build the conditions array
      const conditions = [eq(extractedParameters.responseId, responseId)];
      
      // If userId is provided, add it to the conditions for multi-tenant isolation
      if (userId) {
        conditions.push(eq(extractedParameters.userId, userId));
      }
      
      const params = await db
        .select()
        .from(extractedParameters)
        .where(and(...conditions))
        .limit(1);
      
      if (params.length === 0) {
        return undefined;
      }
      
      return params[0] as ExtractedParameter;
    } catch (error) {
      console.error(`[storage] Error getting extracted parameters for response ID ${responseId}:`, error);
      throw error;
    }
  }

  /**
   * Update extracted parameters for inline editing
   * @param responseId The ID of the response
   * @param userId The user ID for multi-tenant isolation
   * @param parameters The updated parameters object
   * @returns Boolean indicating success
   */
  async updateExtractedParameters(responseId: number, userId?: number, parameters?: Record<string, any>): Promise<boolean> {
    try {
      console.log(`[storage] Updating extracted parameters for response ID ${responseId} with userId=${userId || 'null'}`);
      
      // Build the conditions array
      const conditions = [eq(extractedParameters.responseId, responseId)];
      
      // If userId is provided, add it to the conditions for multi-tenant isolation
      if (userId) {
        conditions.push(eq(extractedParameters.userId, userId));
      }
      
      // Update the parameters
      const updateResult = await db
        .update(extractedParameters)
        .set({
          parameters: parameters,
          lastUpdateDate: new Date()
        })
        .where(and(...conditions));
      
      console.log(`[storage] Updated extracted parameters for response ID ${responseId}`);
      return true;
    } catch (error) {
      console.error(`[storage] Error updating extracted parameters for response ID ${responseId}:`, error);
      return false;
    }
  }

  /**
   * Get all extracted parameters for a specific request, with multi-tenant isolation
   * @param requestId The ID of the request
   * @param userId Optional user ID for multi-tenant isolation
   * @returns Array of extracted parameters
   */
  async getExtractedParametersByRequestId(requestId: number, userId?: number): Promise<ExtractedParameter[]> {
    try {
      // Build the conditions array 
      const conditions = [eq(extractedParameters.requestId, requestId)];
      
      // If userId is provided, add it to the conditions for multi-tenant isolation
      if (userId) {
        conditions.push(eq(extractedParameters.userId, userId));
      }
      
      const params = await db
        .select()
        .from(extractedParameters)
        .where(and(...conditions));
      
      return params as ExtractedParameter[];
    } catch (error) {
      console.error(`[storage] Error getting extracted parameters for request ID ${requestId}, user ID ${userId || 'unknown'}:`, error);
      throw error;
    }
  }

  /**
   * Get extracted parameters for a specific supplier email and request
   * @param requestId The ID of the request
   * @param email The supplier's email
   * @param userId Optional user ID for multi-tenant isolation
   * @returns The extracted parameters or undefined if not found
   */
  async getExtractedParametersByEmail(requestId: number, email: string, userId?: number | null): Promise<ExtractedParameter | undefined> {
    try {
      // Build the conditions array
      const conditions = [
        eq(extractedParameters.requestId, requestId),
        eq(extractedParameters.supplierEmail, email)
      ];
      
      // If userId is provided, add it to the conditions for multi-tenant isolation
      if (userId) {
        conditions.push(eq(extractedParameters.userId, userId));
      }
      
      const params = await db
        .select()
        .from(extractedParameters)
        .where(and(...conditions))
        .limit(1);
      
      if (params.length === 0) {
        return undefined;
      }
      
      return params[0] as ExtractedParameter;
    } catch (error) {
      console.error(`[storage] Error getting extracted parameters for email ${email} in request ${requestId}:`, error);
      throw error;
    }
  }

  /**
   * Extract parameters from supplier response content to create default parameters
   * This prevents sequence gaps by inferring what was requested based on response
   * @param content The supplier response content
   * @returns Array of parameter names that were likely requested
   */
  private extractParametersFromContent(content: string): string[] {
    // This method is deprecated and should not be used
    // Parameters should only come from user selection, not auto-detection
    console.warn('extractParametersFromContent called - this should not happen as auto-parameter creation is disabled');
    return [];
  }

  // Log improvement request for tracking purposes
  async logImprovementRequest(request: {
    requestId: number;
    supplierId?: string;
    supplierEmail: string;
    supplierName: string;
    subject: string;
    message: string;
    requestType?: string;
    trackingId?: string;
    sentAt?: Date;
    userId?: number;
  }): Promise<void> {
    try {
      // Save to improvement_requests table for proper counting
      await db.insert(improvementRequests).values({
        userId: request.userId || null,
        requestId: request.requestId,
        supplierId: request.supplierId || `imp_${request.requestId}_${Date.now()}`, // Use provided ID or generate unique tracking ID
        supplierName: request.supplierName,
        supplierEmail: request.supplierEmail,
        message: request.message,
        subject: request.subject,
        requestType: request.requestType || "improvement", // Default to "improvement" if not specified
        trackingId: request.trackingId, // Add tracking ID for email identification
        sentAt: request.sentAt || new Date() // Default to current date if not provided
      });
      
      console.log(`Improvement request logged for ${request.supplierName} (${request.supplierEmail}) on request ${request.requestId}`);
      
      // Also find the request supplier record to log as outbound message
      const requestSupplier = await this.getRequestSupplierByRequestAndEmail(request.requestId, request.supplierEmail);
      
      if (requestSupplier) {
        // Log this as an outbound message in the request supplier messages table
        await db.insert(requestSupplierMessages).values({
          userId: request.userId || null,
          requestSupplierId: requestSupplier.id,
          subject: request.subject,
          content: request.message,
          direction: 'outbound',
          sentDate: request.sentAt,
          attachments: []
        });
        
        console.log(`Improvement request also logged as outbound message for request supplier ${requestSupplier.id}`);
      } else {
        console.warn(`Could not find request supplier for ${request.supplierEmail} in request ${request.requestId}`);
      }
    } catch (error) {
      console.error('Error logging improvement request:', error);
      throw error;
    }
  }

  // Get improvement request counts grouped by supplier name (using supplier_responses names for consistency)
  async getImprovementRequestCounts(requestId: number): Promise<Record<string, number>> {
    try {
      console.log(`[storage] Getting improvement request counts for request ${requestId}`);
      
      // Count improvement requests directly from improvement_requests table
      // Only count actual improvement requests (not compliance checks)
      const improvementCounts = await db
        .select({
          supplierEmail: improvementRequests.supplierEmail,
          supplierName: improvementRequests.supplierName,
          count: sql<number>`COUNT(*)`.as('count')
        })
        .from(improvementRequests)
        .where(and(
          eq(improvementRequests.requestId, requestId),
          eq(improvementRequests.requestType, "improvement")
        ))
        .groupBy(improvementRequests.supplierEmail, improvementRequests.supplierName);

      // Build counts record using supplier names directly from improvement_requests
      const counts: Record<string, number> = {};
      
      console.log(`[storage] Raw improvement counts:`, improvementCounts);
      
      for (const { supplierName, count } of improvementCounts) {
        console.log(`[storage] Supplier: ${supplierName}, improvement requests: ${count}`);
        counts[supplierName] = count;
      }

      console.log(`[storage] Found improvement counts:`, counts);
      return counts;
    } catch (error) {
      console.error('Error getting improvement request counts:', error);
      throw error;
    }
  }

  // Save improvement request to database for counting
  async saveImprovementRequest(request: {
    userId: number | null;
    requestId: number;
    supplierName: string;
    supplierEmail: string;
    message: string;
    subject: string;
    trackingId: string;
    sentAt: Date;
  }) {
    try {
      const [savedRequest] = await db
        .insert(improvementRequests)
        .values({
          userId: request.userId,
          requestId: request.requestId,
          supplierId: request.trackingId, // Use trackingId as supplierId for tracking
          supplierName: request.supplierName,
          supplierEmail: request.supplierEmail,
          message: request.message,
          subject: request.subject,
          requestType: "improvement", // Explicitly mark as improvement request
          sentAt: request.sentAt
        })
        .returning();
      
      console.log(`Improvement request saved to database with ID ${savedRequest.id}`);
      return savedRequest;
    } catch (error) {
      console.error('Error saving improvement request to database:', error);
      throw error;
    }
  }

  /**
   * Get all users with configured email accounts
   */
  async getUsersWithEmailConfig(): Promise<Array<{ id: number; emailAccount: string }>> {
    try {
      const result = await db
        .select({
          id: users.id,
          emailAccount: users.emailAccount
        })
        .from(users)
        .where(and(
          eq(users.emailConfigured, true),
          isNotNull(users.emailAccount)
        ));
      
      return result.filter(user => user.emailAccount);
    } catch (error) {
      console.error('Error getting users with email config:', error);
      return [];
    }
  }

  /**
   * Update user email configuration
   */
  async updateUserEmailConfig(userId: number, config: {
    emailAccount?: string;
    emailPassword?: string;
    smtpHost?: string;
    smtpPort?: number;
    imapHost?: string;
    imapPort?: number;
    emailConfigured?: boolean;
  }): Promise<boolean> {
    try {
      await db
        .update(users)
        .set({
          ...config,
          updatedAt: sql`now()`
        })
        .where(eq(users.id, userId));
      
      return true;
    } catch (error) {
      console.error(`Error updating email config for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get user email configuration (without decrypting password)
   */
  async getUserEmailConfig(userId: number): Promise<{
    emailAccount?: string;
    emailPassword?: string;
    smtpHost?: string;
    smtpPort?: number;
    imapHost?: string;
    imapPort?: number;
    emailConfigured?: boolean;
  } | null> {
    try {
      const [user] = await db
        .select({
          emailAccount: users.emailAccount,
          emailPassword: users.emailPassword,
          smtpHost: users.smtpHost,
          smtpPort: users.smtpPort,
          imapHost: users.imapHost,
          imapPort: users.imapPort,
          emailConfigured: users.emailConfigured
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      return user || null;
    } catch (error) {
      console.error(`Error getting email config for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Reset user email configuration
   */
  async resetUserEmailConfig(userId: number): Promise<boolean> {
    try {
      await db
        .update(users)
        .set({
          emailAccount: null,
          emailPassword: null,
          smtpHost: 'smtp.mail.ru',
          smtpPort: 587,
          imapHost: 'imap.mail.ru',
          imapPort: 993,
          emailConfigured: false,
          updatedAt: sql`now()`
        })
        .where(eq(users.id, userId));
      
      return true;
    } catch (error) {
      console.error(`Error resetting email config for user ${userId}:`, error);
      return false;
    }
  }

  // Winner selection operations
  async createWinnerSelection(selection: any): Promise<any> {
    try {
      console.log('[Storage] Creating winner selection for request:', selection.requestId);
      
      const [winnerSelection] = await db
        .insert(winnerSelections)
        .values({
          requestId: selection.requestId,
          winnerEmail: selection.winnerEmail,
          winnerName: selection.winnerName,
          selectedDate: selection.selectedDate || new Date(),
          notificationSent: selection.notificationSent || false,
          userId: selection.userId,
          notificationSubject: selection.notificationSubject,
          notificationContent: selection.notificationContent,
          attachments: selection.attachments || []
        })
        .returning();
      
      console.log('[Storage] Winner selection created with ID:', winnerSelection.id);
      return winnerSelection;
    } catch (error) {
      console.error('[Storage] Error creating winner selection:', error);
      throw error;
    }
  }

  async getWinnerByRequestId(requestId: number): Promise<any> {
    try {
      console.log('[Storage] Getting winner for request:', requestId);
      
      const [winner] = await db
        .select({
          winnerEmail: winnerSelections.winnerEmail,
          winnerName: winnerSelections.winnerName,
          selectedDate: winnerSelections.selectedDate,
          notificationSent: winnerSelections.notificationSent
        })
        .from(winnerSelections)
        .where(eq(winnerSelections.requestId, requestId));
      
      return winner || null;
    } catch (error) {
      console.error('[Storage] Error getting winner by request ID:', error);
      throw error;
    }
  }

  async deleteWinnerSelection(requestId: number): Promise<boolean> {
    try {
      console.log('[Storage] Deleting winner selection for request:', requestId);
      
      const result = await db
        .delete(winnerSelections)
        .where(eq(winnerSelections.requestId, requestId))
        .returning({ id: winnerSelections.id });
      
      return result.length > 0;
    } catch (error) {
      console.error('[Storage] Error deleting winner selection:', error);
      throw error;
    }
  }

  // Helper method to generate unique order numbers
}

export const storage = new DatabaseStorage();
storage.initializeSampleData().catch(console.error);
