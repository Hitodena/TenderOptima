/**
 * Validation utilities for REQ and TID formats
 * Ensures compatibility with regex patterns used in email processing
 */

// Allowed characters for REQ order numbers: letters, numbers, dashes, underscores
const REQ_PATTERN = /^[A-Z0-9_-]+$/;
// Allowed characters for TID tracking IDs: letters, numbers, underscores
const TID_PATTERN = /^[A-Za-z0-9_]+$/;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates REQ order number format
 * @param orderNumber - The order number to validate (without REQ- prefix)
 * @returns ValidationResult
 */
export function validateOrderNumber(orderNumber: string): ValidationResult {
  if (!orderNumber || typeof orderNumber !== 'string') {
    return {
      isValid: false,
      error: 'Order number is required and must be a string'
    };
  }

  const trimmed = orderNumber.trim();
  
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Order number cannot be empty'
    };
  }

  if (trimmed.length > 50) {
    return {
      isValid: false,
      error: 'Order number is too long (max 50 characters)'
    };
  }

  if (!REQ_PATTERN.test(trimmed)) {
    return {
      isValid: false,
      error: 'Order number can only contain letters (A-Z), numbers (0-9), dashes (-), and underscores (_)'
    };
  }

  return { isValid: true };
}

/**
 * Validates TID tracking ID format
 * @param trackingId - The tracking ID to validate
 * @returns ValidationResult
 */
export function validateTrackingId(trackingId: string): ValidationResult {
  if (!trackingId || typeof trackingId !== 'string') {
    return {
      isValid: false,
      error: 'Tracking ID is required and must be a string'
    };
  }

  const trimmed = trackingId.trim();
  
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Tracking ID cannot be empty'
    };
  }

  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: 'Tracking ID must be at least 3 characters long'
    };
  }

  if (trimmed.length > 20) {
    return {
      isValid: false,
      error: 'Tracking ID is too long (max 20 characters)'
    };
  }

  if (!TID_PATTERN.test(trimmed)) {
    return {
      isValid: false,
      error: 'Tracking ID can only contain letters (A-Z, a-z), numbers (0-9), and underscores (_)'
    };
  }

  return { isValid: true };
}

/**
 * Generates a valid order number from input
 * @param input - Raw input for order number
 * @returns Valid order number or null if invalid
 */
export function generateValidOrderNumber(input: string): string | null {
  if (!input) return null;
  
  // Remove REQ- prefix if present
  const cleaned = input.replace(/^REQ-?/i, '').trim();
  
  // Validate the cleaned input
  const validation = validateOrderNumber(cleaned);
  if (!validation.isValid) {
    return null;
  }
  
  return cleaned.toUpperCase();
}

/**
 * Generates a valid tracking ID from input
 * @param input - Raw input for tracking ID
 * @returns Valid tracking ID or null if invalid
 */
export function generateValidTrackingId(input: string): string | null {
  if (!input) return null;
  
  const cleaned = input.trim();
  
  // Validate the cleaned input
  const validation = validateTrackingId(cleaned);
  if (!validation.isValid) {
    return null;
  }
  
  return cleaned;
}

/**
 * Sanitizes input to make it compatible with REQ/TID patterns
 * @param input - Raw input
 * @param type - 'order' or 'tracking'
 * @returns Sanitized input
 */
export function sanitizeForPattern(input: string, type: 'order' | 'tracking'): string {
  if (!input) return '';
  
  let sanitized = input.trim();
  
  if (type === 'order') {
    // For order numbers: keep only A-Z, 0-9, -, _
    sanitized = sanitized.replace(/[^A-Z0-9_-]/gi, '');
  } else {
    // For tracking IDs: keep only A-Z, a-z, 0-9, _
    sanitized = sanitized.replace(/[^A-Za-z0-9_]/g, '');
  }
  
  return sanitized;
}