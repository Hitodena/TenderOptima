/**
 * Centralized email pattern definitions for REQ and TID extraction
 * Used by both ImapService and PersonalImapService to ensure consistency
 */

// REQ Order Number Patterns
export const REQ_PATTERNS = {
  // Main pattern for extracting REQ from brackets: [REQ-XXXX-XXXXX]
  BRACKET: /\[REQ-([A-Z0-9_-]+)\]/,
  
  // Direct pattern for REQ in text: REQ-XXXX-XXXXX
  DIRECT: /REQ-[A-Z0-9_-]+/,
  
  // Pattern for content search: order/request number: REQ-XXXX-XXXXX
  CONTENT: /(?:order|request)\s*(?:number|id|#)?\s*[:#\s]+\s*(REQ-[A-Z0-9_-]+)/i,
  
  // Alternative format without REQ prefix: order number: XXXX-XXXXX
  ALTERNATIVE: /(?:order|request)\s*(?:number|id|#)?\s*[:#\s]+\s*([A-Z0-9_-]+)/i,
  
  // Truncated format: -XXXX-XXXXX (to be prefixed with REQ)
  TRUNCATED: /-[A-Z0-9_-]+/,
  
  // Global search patterns (with 'g' flag)
  BRACKET_GLOBAL: /\[REQ-([A-Z0-9_-]+)\]/g,
  DIRECT_GLOBAL: /REQ-[A-Z0-9_-]+/g,
  TRUNCATED_GLOBAL: /-[A-Z0-9_-]+/g,
} as const;

// TID Tracking ID Patterns
export const TID_PATTERNS = {
  // Main pattern for extracting TID from brackets: [TID:XXXXXXXXX]
  BRACKET: /\[TID:([A-Za-z0-9_]+)\]/i,
  
  // Pattern for content search: tracking id: XXXXXXXXX
  CONTENT: /tracking\s*(?:id|number|code)?\s*[:#\s]+\s*([a-zA-Z0-9_]{7,15})/i,
  
  // Global search pattern (with 'g' flag)
  BRACKET_GLOBAL: /\[TID:([A-Za-z0-9_]+)\]/gi,
} as const;

// Validation patterns (for generating valid REQ/TID)
export const VALIDATION_PATTERNS = {
  // Valid characters for REQ order numbers
  REQ_VALID: /^[A-Z0-9_-]+$/,
  
  // Valid characters for TID tracking IDs
  TID_VALID: /^[A-Za-z0-9_]+$/,
} as const;

// Helper functions for pattern matching
export class EmailPatternMatcher {
  /**
   * Extract REQ order number from text using all available patterns
   */
  static extractOrderNumber(text: string): string | null {
    // Try bracket pattern first (highest priority)
    const bracketMatch = text.match(REQ_PATTERNS.BRACKET);
    if (bracketMatch) {
      return `REQ-${bracketMatch[1]}`;
    }
    
    // Try direct pattern
    const directMatch = text.match(REQ_PATTERNS.DIRECT);
    if (directMatch) {
      return directMatch[0];
    }
    
    // Try content pattern
    const contentMatch = text.match(REQ_PATTERNS.CONTENT);
    if (contentMatch) {
      return contentMatch[1];
    }
    
    // Try alternative pattern (without REQ prefix)
    const altMatch = text.match(REQ_PATTERNS.ALTERNATIVE);
    if (altMatch) {
      return `REQ-${altMatch[1]}`;
    }
    
    return null;
  }
  
  /**
   * Extract TID tracking ID from text using all available patterns
   */
  static extractTrackingId(text: string): string | null {
    // Try bracket pattern first (highest priority)
    const bracketMatch = text.match(TID_PATTERNS.BRACKET);
    if (bracketMatch) {
      return bracketMatch[1];
    }
    
    // Try content pattern
    const contentMatch = text.match(TID_PATTERNS.CONTENT);
    if (contentMatch) {
      return contentMatch[1];
    }
    
    return null;
  }
  
  /**
   * Extract all possible order numbers from text
   */
  static extractAllOrderNumbers(text: string): string[] {
    const results: string[] = [];
    
    // Direct matches
    const directMatches = text.match(REQ_PATTERNS.DIRECT_GLOBAL) || [];
    results.push(...directMatches);
    
    // Bracket matches
    const bracketMatches = text.match(REQ_PATTERNS.BRACKET_GLOBAL) || [];
    bracketMatches.forEach(match => {
      const extracted = match.match(REQ_PATTERNS.BRACKET);
      if (extracted) {
        results.push(`REQ-${extracted[1]}`);
      }
    });
    
    // Truncated matches (reconstruct with REQ prefix)
    const truncatedMatches = text.match(REQ_PATTERNS.TRUNCATED_GLOBAL) || [];
    truncatedMatches.forEach(match => {
      results.push(`REQ${match}`);
    });
    
    // Remove duplicates and return
    return Array.from(new Set(results));
  }
  
  /**
   * Validate if a string matches REQ pattern
   */
  static isValidOrderNumber(orderNumber: string): boolean {
    return VALIDATION_PATTERNS.REQ_VALID.test(orderNumber);
  }
  
  /**
   * Validate if a string matches TID pattern
   */
  static isValidTrackingId(trackingId: string): boolean {
    return VALIDATION_PATTERNS.TID_VALID.test(trackingId);
  }
}