import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment variables
 */
function getEncryptionKey(): Buffer {
  const key = process.env.EMAIL_ENCRYPTION_KEY || process.env.SECRET_KEY;
  if (!key) {
    throw new Error('EMAIL_ENCRYPTION_KEY or SECRET_KEY environment variable is required');
  }
  
  // Create a 32-byte key from the provided string
  return crypto.scryptSync(key, 'salt', KEY_LENGTH);
}

/**
 * Encrypt email password
 * @param password - Plain text password
 * @returns Encrypted password in format: iv:encryptedPassword:authTag
 */
export function encryptEmailPassword(password: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipher(ALGORITHM, key);
    cipher.setAAD(Buffer.from('email-password')); // Additional authenticated data
    
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:encryptedPassword:authTag
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  } catch (error) {
    console.error('Error encrypting email password:', error);
    throw new Error('Failed to encrypt email password');
  }
}

/**
 * Decrypt email password
 * @param encryptedPassword - Encrypted password in format: iv:encryptedPassword:authTag
 * @returns Plain text password
 */
export function decryptEmailPassword(encryptedPassword: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedPassword.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted password format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const authTag = Buffer.from(parts[2], 'hex');
    
    const decipher = crypto.createDecipher(ALGORITHM, key);
    decipher.setAAD(Buffer.from('email-password'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting email password:', error);
    throw new Error('Failed to decrypt email password');
  }
}

/**
 * Validate if a string is properly encrypted
 * @param encryptedPassword - String to validate
 * @returns boolean indicating if the format is valid
 */
export function isValidEncryptedPassword(encryptedPassword: string): boolean {
  try {
    const parts = encryptedPassword.split(':');
    if (parts.length !== 3) return false;
    
    // Check if parts are valid hex strings
    Buffer.from(parts[0], 'hex'); // IV
    Buffer.from(parts[2], 'hex'); // AuthTag
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-encrypt all user passwords with a new key (for key rotation)
 * This function should be called when rotating encryption keys
 */
export async function rotateEncryptionKey(oldKey: string, newKey: string, users: Array<{id: number, emailPassword: string}>): Promise<Array<{id: number, newPassword: string}>> {
  const results: Array<{id: number, newPassword: string}> = [];
  
  // Temporarily set old key for decryption
  const originalKey = process.env.EMAIL_ENCRYPTION_KEY;
  process.env.EMAIL_ENCRYPTION_KEY = oldKey;
  
  try {
    for (const user of users) {
      if (user.emailPassword) {
        // Decrypt with old key
        const plainPassword = decryptEmailPassword(user.emailPassword);
        
        // Set new key for encryption
        process.env.EMAIL_ENCRYPTION_KEY = newKey;
        
        // Encrypt with new key
        const newEncryptedPassword = encryptEmailPassword(plainPassword);
        
        results.push({
          id: user.id,
          newPassword: newEncryptedPassword
        });
        
        // Restore old key for next iteration
        process.env.EMAIL_ENCRYPTION_KEY = oldKey;
      }
    }
  } finally {
    // Restore original key
    process.env.EMAIL_ENCRYPTION_KEY = originalKey;
  }
  
  return results;
}

/**
 * Test encryption/decryption with a sample password
 * @returns boolean indicating if encryption is working correctly
 */
export function testEncryption(): boolean {
  try {
    const testPassword = 'test123!@#';
    const encrypted = encryptEmailPassword(testPassword);
    const decrypted = decryptEmailPassword(encrypted);
    
    return testPassword === decrypted && isValidEncryptedPassword(encrypted);
  } catch {
    return false;
  }
}