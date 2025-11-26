// server/services/structuredComplianceAnalyzer.ts

import { TZSection } from './tzSegmenter';
import { extractSupplierModules } from './supplierModuleExtractor';
import { matchSections } from './sectionMatcher';

export interface StructuredAnalysisJob {
  job_id: string;
  strategy: string;  // = 'STRUCTURED_MAPPING'
  tz_section_number: string;
  tz_section_title: string;
  tz_section_content: string;
  supplier_module_content: string;
  supplier_module_title: string;
  requirements: any[];
  match_confidence: number;  // 0-1
  total_tokens: number;
  safe_for_deepseek: boolean;
}

/**
 * Estimate tokens for text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length * 0.85) + 8000;
}

/**
 * Map TZ sections to supplier modules and create analysis jobs
 */
export async function mapSectionsAndCreateJobs(
  tzText: string,
  tzSections: TZSection[],
  supplierText: string,
  requirements: any[]
): Promise<StructuredAnalysisJob[]> {
  // Extract supplier modules
  const supplierModules = extractSupplierModules(supplierText);
  
  if (supplierModules.length === 0) {
    console.warn('⚠️ No supplier modules extracted, returning empty jobs array');
    return [];
  }
  
  // Match TZ sections with supplier modules
  const matches = matchSections(tzSections, supplierModules);
  
  const jobs: StructuredAnalysisJob[] = [];
  
  for (const match of matches) {
    // Find requirements for this TZ section
    const sectionRequirements = requirements.filter(req => 
      req.tech_spec_number && req.tech_spec_number.startsWith(match.tz_section.number)
    );
    
    // If no requirements: skip
    if (sectionRequirements.length === 0) {
      continue;
    }
    
    // Get supplier content (or "[NOT FOUND]" if null)
    const supplierContent = match.supplier_module?.content || '[NOT FOUND]';
    const supplierTitle = match.supplier_module?.title || '[NOT FOUND]';
    
    // Calculate tokens
    let supplierContentToUse = supplierContent;
    let totalTokens = estimateTokens(match.tz_section.content + supplierContentToUse);
    
    // If tokens > 90000: truncate supplier content
    if (totalTokens > 90000) {
      const maxSupplierChars = Math.floor(((90000 - 8000) / 0.85) - match.tz_section.content.length);
      if (maxSupplierChars > 0) {
        supplierContentToUse = supplierContent.substring(0, maxSupplierChars);
        // Find last paragraph
        const lastNewline = supplierContentToUse.lastIndexOf('\n\n');
        if (lastNewline > 0) {
          supplierContentToUse = supplierContentToUse.substring(0, lastNewline);
        }
        // Recalculate tokens
        totalTokens = estimateTokens(match.tz_section.content + supplierContentToUse);
      }
    }
    
    // Create StructuredAnalysisJob
    const job: StructuredAnalysisJob = {
      job_id: `structured_${match.tz_section.number.replace(/\./g, '_')}`,
      strategy: 'STRUCTURED_MAPPING',
      tz_section_number: match.tz_section.number,
      tz_section_title: match.tz_section.name,
      tz_section_content: match.tz_section.content,
      supplier_module_content: supplierContentToUse,
      supplier_module_title: supplierTitle,
      requirements: sectionRequirements,
      match_confidence: match.confidence,
      total_tokens: totalTokens,
      safe_for_deepseek: totalTokens < 120000
    };
    
    jobs.push(job);
  }
  
  console.log(`✓ Created ${jobs.length} structured jobs`);
  return jobs;
}
