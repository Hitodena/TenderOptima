import { storage } from './storage';

/**
 * Проверяет извлеченные параметры для конкретного response ID
 */
async function checkExtractedParams(responseId: number): Promise<void> {
  console.log(`🔍 Checking extracted parameters for response ID: ${responseId}`);
  
  try {
    // Получаем извлеченные параметры
    const extractedParams = await storage.getExtractedParametersByResponseId(responseId);
    
    if (!extractedParams) {
      console.log('❌ No extracted parameters found for this response');
      return;
    }
    
    console.log('📊 Extracted Parameters:');
    console.log(`   Response ID: ${extractedParams.responseId}`);
    console.log(`   Request ID: ${extractedParams.requestId}`);
    console.log(`   Supplier Email: ${extractedParams.supplierEmail}`);
    console.log(`   Status: ${extractedParams.status}`);
    console.log(`   Extraction Date: ${extractedParams.extractionDate}`);
    console.log(`   Last Update: ${extractedParams.lastUpdateDate}`);
    console.log(`   Error Message: ${extractedParams.errorMessage || 'None'}`);
    
    console.log('\n📋 Parameters:');
    if (extractedParams.parameters && typeof extractedParams.parameters === 'object') {
      const params = extractedParams.parameters as Record<string, any>;
      Object.entries(params).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    } else {
      console.log('   No parameters object found');
    }
    
    // Также проверим статус анализа в supplier_responses
    const response = await storage.getSupplierResponse(responseId);
    if (response) {
      console.log(`\n📊 Supplier Response Status:`);
      console.log(`   ID: ${response.id}`);
      console.log(`   Is Analyzed: ${response.isAnalyzed}`);
      console.log(`   Processing Status: ${response.processingStatus}`);
      console.log(`   Processing Error: ${response.processingError || 'None'}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking extracted parameters:', error);
  }
}

// Запуск
const args = process.argv.slice(2);

if (args.length === 1) {
  const responseId = parseInt(args[0]);
  
  if (isNaN(responseId)) {
    console.error('❌ Invalid response ID');
    process.exit(1);
  }
  
  checkExtractedParams(responseId).then(() => {
    console.log('✅ Check completed');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
} else {
  console.log('🔍 Check Extracted Parameters');
  console.log('Usage: node check-extracted-params.ts <responseId>');
  console.log('Example: node check-extracted-params.ts 399');
}
