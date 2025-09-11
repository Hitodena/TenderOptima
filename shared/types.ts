/**
 * Shared types for the SupplierFinder application
 */

// Supplier type
export interface Supplier {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  contactName?: string;
  location?: string;
  rating?: number;
  products?: string[];
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Supplier response attachment type
export interface SupplierResponseAttachment {
  id?: number;
  responseId?: number;
  filename: string;
  contentType: string;
  content?: string;
  size?: number;
  extractedText?: string; 
  createdAt?: Date;
}

// Supplier response type
export interface SupplierResponse {
  id: number;
  requestId: number;
  supplierId: string | number; // Can be string or number depending on context
  supplierName?: string;
  supplierEmail?: string;
  content: string;
  responseDate?: Date;
  isRead?: boolean;
  attachments?: SupplierResponseAttachment[];
  analysisId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Extraction result type
export interface ExtractionResult {
  value: string;
  source: 'content' | 'attachment' | 'none';
  confidence: number;
}

// Search request type
export interface SearchRequest {
  id: number;
  userId: number;
  productName: string;
  productDescription: string;
  quantity: number;
  orderNumber: string;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
  results?: AnalysisResult[];
}

// Request supplier type
export interface RequestSupplier {
  id: number;
  requestId: number;
  supplierId: number;
  supplierName?: string;
  supplierEmail: string;
  trackingId: string;
  hasResponded: boolean;
  messagesSent: number;
  lastContactDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Analysis result type
export interface AnalysisResult {
  id: number;
  requestId: number;
  userId: number | null;
  title: string;
  parameters: unknown;
  comparedSuppliers: unknown;
  recommendedSupplier: string | null;
  recommendationReason: string | null;
  analysisContent: string;
  pdfUrl: string | null;
  dateCreated: Date | null;
}

// Insert types for database
export type InsertSupplier = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertSupplierResponse = Omit<SupplierResponse, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertSearchRequest = Omit<SearchRequest, 'id' | 'createdAt' | 'updatedAt' | 'results'>;
export type InsertRequestSupplier = Omit<RequestSupplier, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertAnalysisResult = Omit<AnalysisResult, 'id' | 'dateCreated'>;