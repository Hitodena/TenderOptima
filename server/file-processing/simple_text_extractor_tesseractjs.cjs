#!/usr/bin/env node
/**
 * Simple Text Extractor with Tesseract.js
 * No system dependencies required - works in Node.js
 */

const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

async function extractTextFromImage(imagePath) {
    try {
        console.log('Starting OCR with Tesseract.js...', { to: 'stderr' });
        
        const { data: { text } } = await Tesseract.recognize(
            imagePath,
            'rus+eng', // Russian and English
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`, { to: 'stderr' });
                    }
                }
            }
        );
        
        return text.trim();
    } catch (error) {
        console.error('Tesseract.js failed:', error.message, { to: 'stderr' });
        return "OCR недоступен: Tesseract.js не смог извлечь текст из изображения";
    }
}

async function extractTextFromPDF(pdfPath) {
    try {
        // For PDF, we'll need to convert to images first
        // This is a simplified version - in production you'd use pdf2pic or similar
        console.log('PDF processing not implemented in this version', { to: 'stderr' });
        return "PDF processing requires additional setup";
    } catch (error) {
        return `Error processing PDF: ${error.message}`;
    }
}

async function extractTextFromTextFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.trim();
    } catch (error) {
        return `Error reading text file: ${error.message}`;
    }
}

async function main() {
    if (process.argv.length !== 4) {
        console.error('Usage: node simple_text_extractor_tesseractjs.js <file_path> <mime_type>', { to: 'stderr' });
        process.exit(1);
    }
    
    const filePath = process.argv[2];
    const mimeType = process.argv[3];
    
    if (!fs.existsSync(filePath)) {
        console.log(JSON.stringify({ error: `File not found: ${filePath}` }));
        process.exit(1);
    }
    
    try {
        let text = "";
        
        // Process based on MIME type
        if (mimeType.startsWith('image/')) {
            text = await extractTextFromImage(filePath);
        } else if (mimeType.startsWith('application/pdf')) {
            text = await extractTextFromPDF(filePath);
        } else if (mimeType.startsWith('text/')) {
            text = await extractTextFromTextFile(filePath);
        } else {
            // Check file extension
            const ext = path.extname(filePath).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(ext)) {
                text = await extractTextFromImage(filePath);
            } else if (ext === '.txt') {
                text = await extractTextFromTextFile(filePath);
            } else {
                console.error(`Unsupported file type: ${mimeType}`, { to: 'stderr' });
                process.exit(1);
            }
        }
        
        // Output JSON format
        const result = {
            text: text || "",
            success: Boolean(text),
            method: "tesseractjs"
        };
        
        console.log(JSON.stringify(result));
        
    } catch (error) {
        console.error(`Error processing file: ${error.message}`, { to: 'stderr' });
        process.exit(1);
    }
}

main().catch(error => {
    console.error(`Fatal error: ${error.message}`, { to: 'stderr' });
    process.exit(1);
});
