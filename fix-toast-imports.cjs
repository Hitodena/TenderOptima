const fs = require('fs');
const path = require('path');

// Список файлов для исправления
const filesToFix = [
  'client/src/pages/dashboard.tsx',
  'client/src/pages/request-details-new.tsx',
  'client/src/pages/contact-group-details.tsx',
  'client/src/pages/send-request.tsx',
  'client/src/components/load-from-contacts.tsx',
  'client/src/components/custom-supplier-input.tsx',
  'client/src/components/supplier-response-attachments.tsx',
  'client/src/pages/admin/admin-login.tsx',
  'client/src/components/improved-improvement-request-modal.tsx',
  'client/src/components/email-template-manager.tsx',
  'client/src/components/supplier-follow-up.tsx',
  'client/src/pages/enhanced-auth-page.tsx',
  'client/src/hooks/use-auth.tsx',
  'client/src/pages/auth-page.tsx',
  'client/src/pages/admin/subscriptions-page.tsx',
  'client/src/components/unified-supplier-search.tsx',
  'client/src/components/supplier-search-form.tsx',
  'client/src/pages/SupplierSearchPage.tsx',
  'client/src/hooks/use-auth.ts',
  'client/src/pages/admin/moderation-page.tsx',
  'client/src/pages/send-group-email-page.tsx',
  'client/src/components/SupplierFormDialog.tsx',
  'client/src/components/ResponseHistoryModal.tsx',
  'client/src/pages/contact-groups.tsx',
  'client/src/pages/clone-request.tsx',
  'client/src/hooks/use-enhanced-auth.tsx',
  'client/src/pages/settings-page-wrapper.tsx',
  'client/src/pages/email-request-details.tsx',
  'client/src/pages/create-email-request-page.tsx',
  'client/src/hooks/use-contact-groups.tsx',
  'client/src/components/upload-suppliers-excel.tsx',
  'client/src/components/supplier-results.tsx',
  'client/src/components/send-group-email.tsx',
  'client/src/components/send-group-email-link.tsx',
  'client/src/components/file-upload.tsx',
  'client/src/components/add-to-group-button.tsx',
  'client/src/components/add-to-contact-group.tsx'
];

function fixToastImport(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Проверяем, есть ли неправильный импорт
    if (content.includes('from "@/hooks/use-toast"')) {
      content = content.replace(
        /import\s*{\s*useToast\s*}\s*from\s*["']@\/hooks\/use-toast["']/g,
        'import { useToast } from "@/components/ui/toast"'
      );
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
    } else {
      console.log(`⏭️  No fix needed: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
}

console.log('🔧 Fixing toast imports...\n');

filesToFix.forEach(fixToastImport);

console.log('\n✅ All toast imports have been fixed!');
