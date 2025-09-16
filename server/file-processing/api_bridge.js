/**
 * API Bridge for Attachment Analyzer
 * 
 * This module provides a bridge between the Node.js server and Python attachment analyzer.
 * It handles spawning Python processes to extract and analyze text from email attachments.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const os = require('os');

const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);
const readFile = util.promisify(fs.readFile);

// Base directory for temporary files
const TEMP_DIR = path.join(os.tmpdir(), 'supplier-finder-attachments');

// Path to the Python script (relative to this file)
const ANALYZER_SCRIPT = path.join(__dirname, 'attachment_analyzer.py');

// Output directory for processed attachments
const OUTPUT_DIR = path.join(__dirname, 'processed_attachments');

// Ensure temp and output directories exist
try {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
} catch (err) {
  console.error('Error creating directories:', err);
}

/**
 * Process attachments from a supplier response
 * 
 * @param {Object} response - The supplier response object with attachments
 * @returns {Promise<Object>} - The analysis results
 */
async function analyzeSupplierResponseAttachments(response) {
  console.log(`Processing attachments for response ${response.id} from ${response.supplierName || response.supplierEmail}`);
  
  try {
    // Create a temp file with the response data
    const tempFilePath = path.join(TEMP_DIR, `response_${response.id}_${Date.now()}.json`);
    await writeFile(tempFilePath, JSON.stringify(response, null, 2), 'utf8');
    
    // Spawn Python process
    const result = await runPythonAnalyzer(tempFilePath);
    
    // Clean up temp file
    fs.unlink(tempFilePath, (err) => {
      if (err) console.error(`Error deleting temp file ${tempFilePath}:`, err);
    });
    
    return result;
  } catch (error) {
    console.error('Error in analyzeSupplierResponseAttachments:', error);
    throw error;
  }
}

/**
 * Process attachments from multiple supplier responses
 * 
 * @param {Array<Object>} responses - Array of supplier response objects with attachments
 * @returns {Promise<Object>} - The batch analysis results
 */
async function analyzeBatchResponses(responses) {
  console.log(`Processing batch of ${responses.length} responses`);
  
  try {
    // Create a temp file with the responses data
    const tempFilePath = path.join(TEMP_DIR, `batch_${Date.now()}.json`);
    await writeFile(tempFilePath, JSON.stringify(responses, null, 2), 'utf8');
    
    // Spawn Python process
    const result = await runPythonAnalyzer(tempFilePath);
    
    // Clean up temp file
    fs.unlink(tempFilePath, (err) => {
      if (err) console.error(`Error deleting temp file ${tempFilePath}:`, err);
    });
    
    return result;
  } catch (error) {
    console.error('Error in analyzeBatchResponses:', error);
    throw error;
  }
}

/**
 * Run the Python analyzer script
 * 
 * @param {string} inputFilePath - Path to the input JSON file
 * @returns {Promise<Object>} - The analysis results
 */
function runPythonAnalyzer(inputFilePath) {
  return new Promise((resolve, reject) => {
    // Determine Python executable (use python for Windows compatibility)
    const pythonExecutable = 'python';
    
    // Check if file exists
    if (!fs.existsSync(ANALYZER_SCRIPT)) {
      return reject(new Error(`Analyzer script not found at ${ANALYZER_SCRIPT}`));
    }
    
    console.log(`Running Python analyzer: ${pythonExecutable} ${ANALYZER_SCRIPT} --input ${inputFilePath}`);
    
    const process = spawn(pythonExecutable, [
      ANALYZER_SCRIPT,
      '--input', inputFilePath,
      '--output-dir', OUTPUT_DIR
    ]);
    
    let stdoutData = '';
    let stderrData = '';
    
    process.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`Python stderr: ${data}`);
    });
    
    process.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error(`stderr: ${stderrData}`);
        return reject(new Error(`Python analyzer exited with code ${code}: ${stderrData}`));
      }
      
      try {
        // Clean up the output - make sure we only have valid JSON
        let cleanOutput = stdoutData.trim();
        
        // Find the first '{' and the last '}' to isolate the JSON object
        const startIndex = cleanOutput.indexOf('{');
        const endIndex = cleanOutput.lastIndexOf('}');
        
        if (startIndex >= 0 && endIndex > startIndex) {
          cleanOutput = cleanOutput.substring(startIndex, endIndex + 1);
        }
        
        // Try to parse the cleaned JSON output
        const result = JSON.parse(cleanOutput);
        resolve(result);
      } catch (err) {
        console.error('Error parsing Python output:', err);
        console.error('Raw output:', stdoutData);
        
        // Try again with a more aggressive approach - find any JSON-like structure
        try {
          const matches = stdoutData.match(/\{[\s\S]*\}/);
          if (matches && matches[0]) {
            const result = JSON.parse(matches[0]);
            console.log('Successfully parsed JSON with fallback method');
            resolve(result);
            return;
          }
        } catch (fallbackErr) {
          console.error('Fallback parsing also failed:', fallbackErr);
        }
        
        reject(new Error(`Failed to parse Python output: ${err.message}`));
      }
    });
    
    process.on('error', (err) => {
      console.error('Error spawning Python process:', err);
      reject(err);
    });
  });
}

/**
 * Get analysis results for a specific response
 * 
 * @param {number} responseId - The ID of the response
 * @returns {Promise<Object|null>} - The analysis results or null if not found
 */
async function getAnalysisResult(responseId) {
  try {
    // Find the most recent analysis file for this response
    const files = fs.readdirSync(OUTPUT_DIR);
    const analysisFiles = files.filter(file => 
      file.startsWith(`analysis_${responseId}_`) && file.endsWith('.json')
    );
    
    if (analysisFiles.length === 0) {
      return null;
    }
    
    // Sort by timestamp (newest first)
    analysisFiles.sort().reverse();
    
    // Read the most recent file
    const latestFile = path.join(OUTPUT_DIR, analysisFiles[0]);
    const data = await readFile(latestFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error getting analysis for response ${responseId}:`, error);
    return null;
  }
}

module.exports = {
  analyzeSupplierResponseAttachments,
  analyzeBatchResponses,
  getAnalysisResult
};