#!/usr/bin/env python3
"""
Attachment Analyzer for SupplierFinder

This module integrates with the SupplierFinder application to automatically
extract text from attachments in supplier emails and prepare the data for analysis.
"""

import os
import sys
import json
import logging
from datetime import datetime
import base64
import tempfile
from typing import Dict, List, Any, Optional, Union
import traceback
import re

# Import file processor
from file_processor import FileProcessor, process_attachment_batch

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,  # Changed to DEBUG for more detailed logging
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("attachment_analyzer.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("attachment_analyzer")

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "processed_attachments")
os.makedirs(OUTPUT_DIR, exist_ok=True)

class AttachmentAnalyzer:
    """Interface between SupplierFinder and the file processing module"""
    
    def __init__(self, output_dir: str = OUTPUT_DIR):
        """
        Initialize the AttachmentAnalyzer
        
        Args:
            output_dir: Directory to store processed output files
        """
        self.output_dir = output_dir
        self.processor = FileProcessor(output_dir=output_dir)
        
        logger.info(f"AttachmentAnalyzer initialized with output directory: {output_dir}")
    
    def analyze_supplier_response(self, response_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process attachments from a single supplier response
        
        Args:
            response_data: Dictionary containing response data from the database
                Must include:
                - id: Response ID
                - supplierName: Name of the supplier
                - supplierEmail: Email of the supplier
                - responseDate: Date of response
                - requestId: ID of the request
                - attachments: List of attachment objects with:
                  - filename: Name of the file
                  - content: Base64-encoded file content
                  - contentType: MIME type of the file
        
        Returns:
            Dictionary with analysis results
        """
        logger.info(f"Analyzing supplier response {response_data.get('id', 'unknown')} "
                   f"from {response_data.get('supplierName', 'unknown')}")
        
        attachments = response_data.get('attachments', [])
        
        if not attachments:
            logger.info(f"No attachments found in response {response_data.get('id', 'unknown')}")
            return {
                "response_id": response_data.get('id'),
                "supplier_name": response_data.get('supplierName'),
                "supplier_email": response_data.get('supplierEmail'),
                "attachments_processed": 0,
                "text_extracted": False,
                "message": "No attachments found"
            }
        
        # Process each attachment
        processed_attachments = []
        for i, attachment in enumerate(attachments):
            filename = attachment.get('filename', 'unknown.file')
            content_type = attachment.get('contentType', 'unknown')
            logger.info(f"Processing attachment {i+1}/{len(attachments)}: {filename} (type: {content_type})")
            
            try:
                # Decode base64 content
                file_content = base64.b64decode(attachment.get('content', ''))
                logger.debug(f"Decoded {len(file_content)} bytes for {filename}")
                
                processed = self.processor.process_attachment(
                    file_data=file_content,
                    filename=filename,
                    supplier_name=response_data.get('supplierName', 'Unknown Supplier'),
                    supplier_email=response_data.get('supplierEmail', 'unknown@example.com'),
                    email_date=response_data.get('responseDate', datetime.now().isoformat()),
                    request_id=response_data.get('requestId')
                )
                
                logger.info(f"Successfully processed {filename}: extracted {len(processed.get('text_content', ''))} chars")
                
                # Check for processing status information
                processing_status = processed.get('processing_status', {})
                if processing_status.get('status') == 'success':
                    logger.info(f"Successfully processed {filename} using method: {processing_status.get('method', 'unknown')}")
                elif processing_status.get('status') == 'partial_failure':
                    logger.warning(f"Warning: {filename} processed with warnings: {processing_status.get('user_message', 'unknown issue')}")
                else:
                    logger.warning(f"Warning: {filename} processing status unclear: {processing_status}")
                
                # Check if there was an error in processing
                processing_status = processed.get('processing_status', {})
                has_error = processing_status.get('status') == 'partial_failure'
                error_message = processing_status.get('user_message', '') if has_error else ''
                
                processed_attachments.append({
                    "filename": filename,
                    "content_type": content_type,
                    "extracted_text": processed.get('text_content', ''),
                    "extracted_data": processed.get('data'),
                    "error": has_error,
                    "error_message": error_message,
                    "processing_method": processing_status.get('method', 'unknown'),
                    "processing_status": processing_status
                })
                
            except Exception as e:
                logger.error(f"CRITICAL ERROR processing {filename}: {str(e)}")
                logger.error(f"Traceback for {filename}:")
                logger.error(traceback.format_exc())
                
                processed_attachments.append({
                    "filename": filename,
                    "content_type": content_type,
                    "extracted_text": "",
                    "extracted_data": None,
                    "error": True,
                    "error_message": str(e),
                    "processing_method": "failed",
                    "processing_status": {"status": "critical_failure", "error": str(e)}
                })
        
        # Create summary of extracted content
        extracted_texts = [a.get('extracted_text', '') for a in processed_attachments 
                          if not a.get('error', False) and a.get('extracted_text')]
        
        combined_text = "\n\n".join(extracted_texts)
        
        # Analyze the extracted text
        analysis_result = self._analyze_text(combined_text)
        
        result = {
            "response_id": response_data.get('id'),
            "supplier_name": response_data.get('supplierName'),
            "supplier_email": response_data.get('supplierEmail'),
            "request_id": response_data.get('requestId'),
            "response_date": response_data.get('responseDate'),
            "attachments_processed": len(processed_attachments),
            "text_extracted": bool(combined_text),
            "extracted_content": {
                "text_summary": self._generate_text_summary(combined_text),
                "combined_text_length": len(combined_text),
                "attachments": processed_attachments
            },
            # Для обратной совместимости добавляем также processed_attachments на верхнем уровне
            "processed_attachments": processed_attachments,
            "analysis": analysis_result
        }
        
        # Save complete result
        result_filename = f"analysis_{response_data.get('id')}_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
        with open(os.path.join(self.output_dir, result_filename), 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2, default=str)
        
        logger.info(f"Analysis complete for response {response_data.get('id')}, "
                   f"processed {len(processed_attachments)} attachments")
        
        return result
    
    def analyze_batch(self, responses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Process attachments from multiple supplier responses
        
        Args:
            responses: List of response data dictionaries
        
        Returns:
            Dictionary with batch analysis results
        """
        logger.info(f"Processing batch of {len(responses)} supplier responses")
        
        results = []
        for response in responses:
            try:
                result = self.analyze_supplier_response(response)
                results.append(result)
            except Exception as e:
                logger.error(f"Error processing response {response.get('id', 'unknown')}: {str(e)}")
                logger.error(traceback.format_exc())
                
                results.append({
                    "response_id": response.get('id'),
                    "supplier_name": response.get('supplierName'),
                    "supplier_email": response.get('supplierEmail'),
                    "error": True,
                    "error_message": str(e)
                })
        
        # Compile batch results
        batch_summary = {
            "total_responses": len(responses),
            "successful": len([r for r in results if not r.get('error', False)]),
            "with_attachments": len([r for r in results if r.get('attachments_processed', 0) > 0]),
            "text_extracted": len([r for r in results if r.get('text_extracted', False)]),
            "timestamp": datetime.now().isoformat(),
            "results": results
        }
        
        # Save batch summary
        batch_filename = f"batch_analysis_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
        with open(os.path.join(self.output_dir, batch_filename), 'w', encoding='utf-8') as f:
            json.dump(batch_summary, f, ensure_ascii=False, indent=2, default=str)
        
        logger.info(f"Batch processing complete: {batch_summary['successful']} successful, "
                   f"{batch_summary['with_attachments']} with attachments, "
                   f"{batch_summary['text_extracted']} with extracted text")
        
        return batch_summary
    
    def _generate_text_summary(self, text: str, max_length: int = 500) -> str:
        """Generate a summary of extracted text"""
        if not text:
            return ""
        
        # Remove excessive whitespace
        clean_text = re.sub(r'\s+', ' ', text).strip()
        
        # Truncate if too long
        if len(clean_text) > max_length:
            return clean_text[:max_length] + "..."
        
        return clean_text
    
    def _analyze_text(self, text: str) -> Dict[str, Any]:
        """
        Perform basic analysis of extracted text
        
        This method could be expanded with more sophisticated analysis,
        including price detection, product identification, etc.
        """
        if not text:
            return {"has_content": False}
        
        word_count = len(re.findall(r'\b\w+\b', text))
        
        # Look for prices (basic detection - can be improved)
        price_patterns = [
            r'(\d+[.,]?\d*)\s*(руб|₽|RUB|USD|\$|EUR|€)',  # Currencies with symbols
            r'(\d+[.,]?\d*)\s*(рублей|долларов|евро)',     # Currency words
            r'цена:?\s*(\d+[.,]?\d*)',                    # Price indicators
            r'стоимость:?\s*(\d+[.,]?\d*)',              # Cost indicators
            r'(\d+[.,]?\d*)\s*₽'                         # Ruble symbol
        ]
        
        prices = []
        for pattern in price_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                prices.extend(matches)
        
        # Sample data extraction - could be expanded based on specific needs
        analysis = {
            "has_content": True,
            "word_count": word_count,
            "character_count": len(text),
            "detected_prices": prices[:10],  # Limit to first 10 prices
            "has_prices": len(prices) > 0,
            "price_count": len(prices)
        }
        
        return analysis


def main():
    """Command-line entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Analyze attachments from supplier emails')
    parser.add_argument('--input', '-i', required=True, help='Input JSON file with supplier response data')
    parser.add_argument('--output-dir', '-o', default=OUTPUT_DIR, help='Output directory for processed files')
    
    args = parser.parse_args()
    
    analyzer = AttachmentAnalyzer(output_dir=args.output_dir)
    
    # Load input data
    try:
        with open(args.input, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        logger.error(f"Error loading input file: {str(e)}")
        sys.exit(1)
    
    # Process based on structure (single response or batch)
    if isinstance(data, list):
        result = analyzer.analyze_batch(data)
    else:
        result = analyzer.analyze_supplier_response(data)
    
    # Clean any stdout buffer and ensure only clean JSON output
    sys.stdout.flush()
    # Print only the JSON result without any additional output
    print(json.dumps(result, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()