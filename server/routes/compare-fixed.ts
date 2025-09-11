import { Request, Response } from 'express';
import { storage } from '../storage';
import { requireAuth } from '../middleware/requireAuth';
import type { SupplierResponse } from '../../shared/types';

// CSV generation function
function generateCSV(data: any[], columns: string[]): string {
  const header = columns.join(',');
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col] || '';
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

// HTML table generation function
function generateHTMLTable(data: any[], columns: string[]): string {
  const header = columns.map(col => `<th>${col}</th>`).join('');
  const rows = data.map(row => 
    `<tr>${columns.map(col => `<td>${row[col] || ''}</td>`).join('')}</tr>`
  ).join('');
  return `<table border="1"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

// Fixed comparison data generation that uses pre-extracted parameters
export async function generateFixedComparisonData(suppliers: any[], parameters: string[], requestId?: number, userId?: number) {
  try {
    console.log(`[FIXED COMPARISON] Starting comparison for request ${requestId} with ${suppliers.length} suppliers`);
    console.log(`[FIXED COMPARISON] Parameters: ${JSON.stringify(parameters)}`);
    console.log(`[FIXED COMPARISON] Supplier structure sample:`, suppliers[0]);
    
    // Get all supplier responses for the request
    let supplierResponses = await storage.getSupplierResponses(requestId || null, userId);
    
    if (supplierResponses.length === 0 && userId) {
      supplierResponses = await storage.getSupplierResponses(requestId || null);
    }
    
    if (supplierResponses.length === 0) {
      throw new Error('No supplier responses found');
    }
    
    console.log(`[FIXED COMPARISON] Total supplier responses available: ${supplierResponses.length}`);
    console.log(`[FIXED COMPARISON] Sample supplier response:`, supplierResponses[0]);
    
    // Extract response IDs from suppliers - handle both old and new data structures
    const responseIds = suppliers.flatMap(s => {
      console.log(`[FIXED COMPARISON] Processing supplier:`, s);
      if (s.responseIds && Array.isArray(s.responseIds)) {
        // New structure with responseIds array
        return s.responseIds.map((id: any) => Number(id));
      } else if (s.id) {
        // Old structure with single id field - this is the most common case
        return [Number(s.id)];
      }
      return [];
    });

    
    console.log(`[FIXED COMPARISON] Looking for response IDs: ${responseIds}`);
    
    // Filter responses to only include the selected suppliers by response IDs
    console.log(`[FIXED COMPARISON] Filtering to only selected response IDs: ${responseIds}`);
    const relevantResponses = supplierResponses.filter(response => 
      response.requestId === requestId && responseIds.includes(response.id)
    );
    
    console.log(`[FIXED COMPARISON] Relevant responses found: ${relevantResponses.length}`);
    relevantResponses.forEach(r => {
      console.log(`[FIXED COMPARISON] Response ${r.id}: email="${r.supplierEmail}", name="${r.supplierName}"`);
    });
    
    console.log(`[FIXED COMPARISON] Found ${relevantResponses.length} relevant responses`);
    
    // Group responses by email (the correct way)
    const responsesByEmail = new Map<string, SupplierResponse[]>();
    
    relevantResponses.forEach(response => {
      console.log(`[FIXED COMPARISON] Processing response ${response.id}: email="${response.supplierEmail}", name="${response.supplierName}"`);
      
      if (!response.supplierEmail) {
        console.log(`[FIXED COMPARISON] No email found for response ${response.id}, skipping`);
        return;
      }
      
      const email = response.supplierEmail.toLowerCase().trim();
      // FIXED: Accept any valid email format, don't skip responses
      if (!email) {
        console.log(`[FIXED COMPARISON] Empty email for response ${response.id}, skipping`);
        return;
      }
      
      console.log(`[FIXED COMPARISON] Using email "${email}" for response ${response.id}`);
      
      if (!responsesByEmail.has(email)) {
        responsesByEmail.set(email, []);
      }
      responsesByEmail.get(email)!.push(response as any);
    });
    
    console.log(`[FIXED COMPARISON] Grouped into ${responsesByEmail.size} unique email addresses`);
    
    // Create supplier data with email as name (fixing the naming issue)
    const supplierDetails: any[] = [];
    const parameterValues: Record<string, Record<string, string>> = {};
    
    // Initialize parameter structure
    parameters.forEach(param => {
      parameterValues[param] = {};
    });
    
    // Process each email group and aggregate their parameter data
    for (const [email, responses] of Array.from(responsesByEmail.entries())) {
      console.log(`[FIXED COMPARISON] Processing email: ${email} with ${responses.length} responses`);
      
      // Sort responses by date (newest first) for latest-value priority
      const sortedResponses = responses.sort((a, b) => {
        const dateA = a.responseDate ? new Date(a.responseDate).getTime() : 0;
        const dateB = b.responseDate ? new Date(b.responseDate).getTime() : 0;
        return dateB - dateA;
      });
      
      // Use the supplier name directly from the most recent email response
      let supplierName = email; // Fallback to email if no supplier name found
      
      // Find the supplier name from the most recent response first
      for (const response of sortedResponses) {
        if (response.supplierName && response.supplierName.trim() && response.supplierName !== email) {
          supplierName = response.supplierName;
          console.log(`[FIXED COMPARISON] Using supplier name "${supplierName}" from latest email response for ${email}`);
          break;
        }
      }
      
      if (supplierName === email) {
        console.log(`[FIXED COMPARISON] No supplier name found in responses, using email as fallback: ${email}`);
      }
      
      // Count only responses that match the selected supplier IDs
      const selectedResponseCount = responses.filter(response => 
        responseIds.includes(response.id)
      ).length;
      
      const supplierDetail = {
        id: sortedResponses[0].id, // Use most recent response ID
        name: supplierName,
        email: email,
        phone: '',
        website: '',
        contactName: '',
        responseCount: selectedResponseCount || responses.length // Fallback to total if no matches
      };
      
      supplierDetails.push(supplierDetail);
      
      // Aggregate parameter values across all responses for this supplier
      const aggregatedParams: Record<string, { latest: string; first: string; latestDate: Date; firstDate: Date; hasValue: boolean; sourceResponseId: number }> = {};
      
      // Process all responses to find latest and first values for each parameter
      for (const response of sortedResponses) {
        try {
          console.log(`[FIXED COMPARISON] Loading pre-extracted parameters for response ${response.id} (${response.responseDate})`);
          
          // CRITICAL FIX: Get parameters by response ID to ensure we get each individual response's data
          const extractedParams = await storage.getExtractedParametersByResponseId(response.id, userId);
          
          if (extractedParams && extractedParams.parameters) {
            let parsedParams = extractedParams.parameters;
            
            // Parse if it's a JSON string
            if (typeof parsedParams === 'string') {
              try {
                parsedParams = JSON.parse(parsedParams);
              } catch (e) {
                console.error(`[FIXED COMPARISON] Error parsing parameters for response ${response.id}:`, e);
                continue;
              }
            }
            
            console.log(`[FIXED COMPARISON] Processing parameters for response ${response.id}:`, parsedParams);
            
            // CRITICAL FIX: Aggregate ALL non-empty parameters from all emails of this supplier
            for (const [paramName, paramValue] of Object.entries(parsedParams)) {
              if (parameters.includes(paramName) && paramValue && String(paramValue).trim() !== '-' && String(paramValue).trim() !== '') {
                const value = String(paramValue).trim();
                const responseDate = response.responseDate ? new Date(response.responseDate) : new Date();
                
                console.log(`[FIXED COMPARISON] Found parameter "${paramName}" = "${value}" from response ${response.id} (${responseDate.toISOString()})`);
                
                // FIXED: Always accept the first non-empty value found for each parameter, regardless of date
                if (!aggregatedParams[paramName] || !aggregatedParams[paramName].hasValue) {
                  // First non-empty value found for this parameter - accept it!
                  aggregatedParams[paramName] = {
                    latest: value,
                    first: value,
                    latestDate: responseDate,
                    firstDate: responseDate,
                    hasValue: true,
                    sourceResponseId: response.id // Track which response this parameter came from
                  };
                  console.log(`[FIXED COMPARISON] ✓ ACCEPTED first non-empty value for ${paramName}: "${value}" from response ${response.id}`);
                } else {
                  // We already have a value for this parameter, check if we should update based on date
                  if (responseDate > aggregatedParams[paramName].latestDate) {
                    const previousValue = aggregatedParams[paramName].latest;
                    aggregatedParams[paramName].latest = value;
                    aggregatedParams[paramName].latestDate = responseDate;
                    aggregatedParams[paramName].sourceResponseId = response.id; // Update source response ID
                    console.log(`[FIXED COMPARISON] ✓ UPDATED latest value for ${paramName}: "${previousValue}" → "${value}" (newer response ${response.id})`);
                  }
                  // Update first if this response is older
                  if (responseDate < aggregatedParams[paramName].firstDate) {
                    aggregatedParams[paramName].first = value;
                    aggregatedParams[paramName].firstDate = responseDate;
                    console.log(`[FIXED COMPARISON] ✓ UPDATED first value for ${paramName}: "${value}" (older response ${response.id})`);
                  }
                }
              } else if (parameters.includes(paramName)) {
                console.log(`[FIXED COMPARISON] ✗ SKIPPING parameter "${paramName}" with empty/dash value: "${paramValue}" from response ${response.id}`);
              }
            }
          } else {
            console.log(`[FIXED COMPARISON] No pre-extracted parameters found for response ${response.id}`);
          }
        } catch (error) {
          console.error(`[FIXED COMPARISON] Error processing response ${response.id}:`, error);
        }
      }
      
      // Store final aggregated values for this supplier with historical context
      for (const paramName of parameters) {
        if (aggregatedParams[paramName] && aggregatedParams[paramName].hasValue) {
          const { latest, first, sourceResponseId } = aggregatedParams[paramName];
          // Create display value with history if values changed
          let displayValue = latest;
          let exportValue = latest;
          if (first !== latest && first !== latest) {
            displayValue = `${latest} (ранее: ${first})`;
            exportValue = `${latest} (ранее: ${first})`;
          }
          parameterValues[paramName][email] = displayValue;
          parameterValues[paramName][`${email}_export`] = exportValue;
          parameterValues[paramName][`${email}_sourceResponseId`] = sourceResponseId; // Store source response ID
          console.log(`[FIXED COMPARISON] Final aggregated ${paramName} = "${displayValue}" for ${email} (source: response ${sourceResponseId})`);
        } else {
          parameterValues[paramName][email] = '-';
          parameterValues[paramName][`${email}_export`] = '-';
          parameterValues[paramName][`${email}_sourceResponseId`] = null;
          console.log(`[FIXED COMPARISON] No value found for ${paramName} for ${email}`);
        }
      }
    }
    
    // Generate table data with source response ID information
    const tableData = parameters.map(param => {
      const row: Record<string, any> = { 'Parameter': param };
      
      supplierDetails.forEach(supplier => {
        const value = parameterValues[param][supplier.email] || '-';
        const sourceResponseId = parameterValues[param][`${supplier.email}_sourceResponseId`] || null;
        
        // CRITICAL FIX: Use email as key to prevent data collision between suppliers with same name but different emails
        row[supplier.email] = value;
        // Store source response ID for editing functionality
        row[`${supplier.email}_sourceResponseId`] = sourceResponseId;
        console.log(`[FIXED COMPARISON] Table row: ${param} -> ${supplier.email} (${supplier.name}) = ${value} (source: response ${sourceResponseId})`);
      });
      
      return row;
    });
    
    console.log(`[FIXED COMPARISON] Generated table with ${tableData.length} rows for ${supplierDetails.length} suppliers`);
    console.log(`[FIXED COMPARISON] Supplier details array:`, supplierDetails);
    
    // Generate CSV
    const csvColumns = ['Parameter', ...supplierDetails.map(s => s.email)];
    let csv = csvColumns.join(';') + '\n';
    
    tableData.forEach(row => {
      const rowData = csvColumns.map(col => {
        const value = row[col] ? String(row[col]).replace(/;/g, ',') : '';
        return (value.includes(',') || value.includes('\n')) ? `"${value}"` : value;
      });
      csv += rowData.join(';') + '\n';
    });
    
    // Generate HTML table
    let htmlTable = '<div class="overflow-x-auto">\n';
    htmlTable += '<table class="min-w-full divide-y divide-gray-200">\n';
    htmlTable += '<thead>\n<tr class="bg-gray-50">\n';
    csvColumns.forEach(col => {
      htmlTable += `<th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${col}</th>\n`;
    });
    htmlTable += '</tr>\n</thead>\n';
    htmlTable += '<tbody class="bg-white divide-y divide-gray-200">\n';
    
    tableData.forEach((row, idx) => {
      htmlTable += `<tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">\n`;
      csvColumns.forEach(col => {
        const value = row[col] || '-';
        htmlTable += `<td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">${value}</td>\n`;
      });
      htmlTable += '</tr>\n';
    });
    htmlTable += '</tbody>\n</table>\n</div>';
    
    const response = {
      suppliers: supplierDetails,
      supplierDetails: supplierDetails, // Frontend expects this field name
      tableData,
      csv,
      htmlTable,
      formattedAnalysis: `Comparison generated for ${supplierDetails.length} suppliers with ${parameters.length} parameters`,
      aiAnalysis: null
    };
    
    console.log(`[FIXED COMPARISON] Response structure:`, Object.keys(response));
    console.log(`[FIXED COMPARISON] supplierDetails in response:`, !!response.supplierDetails);
    
    return response;
    
  } catch (error) {
    console.error('[FIXED COMPARISON] Error:', error);
    throw error;
  }
}

// API endpoint handler
export const handleFixedCompareRequest = async (req: Request, res: Response) => {
  console.log('[FIXED COMPARISON API] ================================');
  console.log('[FIXED COMPARISON API] REQUEST RECEIVED!');
  console.log('[FIXED COMPARISON API] Method:', req.method);
  console.log('[FIXED COMPARISON API] URL:', req.url);
  console.log('[FIXED COMPARISON API] Body keys:', Object.keys(req.body || {}));
  console.log('[FIXED COMPARISON API] ================================');
  try {
    const { suppliers, parameters, requestId } = req.body;
    const userId = req.user?.id || req.session?.userId;
    
    console.log('[FIXED COMPARISON API] Received request:', { suppliers: suppliers?.length, parameters: parameters?.length, requestId });
    
    if (!suppliers || !parameters || !Array.isArray(suppliers) || !Array.isArray(parameters)) {
      return res.status(400).json({ error: 'Invalid suppliers or parameters' });
    }
    
    const result = await generateFixedComparisonData(suppliers, parameters, requestId, userId);
    
    res.json(result);
    
  } catch (error) {
    console.error('[FIXED COMPARISON API] Error:', error);
    res.status(500).json({ error: 'Comparison generation failed' });
  }
};