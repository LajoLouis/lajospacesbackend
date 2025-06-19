import { logger } from '../utils/logger';
import { AppError } from '../utils/appError';

// File type signatures for validation
const FILE_SIGNATURES = {
  // Image formats
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF],
    [0xFF, 0xD8, 0xFF, 0xE0],
    [0xFF, 0xD8, 0xFF, 0xE1],
    [0xFF, 0xD8, 0xFF, 0xE2],
    [0xFF, 0xD8, 0xFF, 0xE3],
    [0xFF, 0xD8, 0xFF, 0xE8]
  ],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
  ],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'image/bmp': [[0x42, 0x4D]],
  'image/tiff': [
    [0x49, 0x49, 0x2A, 0x00],
    [0x4D, 0x4D, 0x00, 0x2A]
  ],
  
  // Document formats
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    [0x50, 0x4B, 0x03, 0x04],
    [0x50, 0x4B, 0x05, 0x06],
    [0x50, 0x4B, 0x07, 0x08]
  ],
  
  // Video formats
  'video/mp4': [
    [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70],
    [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]
  ],
  'video/quicktime': [[0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70]],
  'video/webm': [[0x1A, 0x45, 0xDF, 0xA3]],
  
  // Audio formats
  'audio/mpeg': [[0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2]],
  'audio/wav': [[0x52, 0x49, 0x46, 0x46]],
  'audio/ogg': [[0x4F, 0x67, 0x67, 0x53]]
};

// Dangerous file extensions and MIME types
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
  '.app', '.deb', '.pkg', '.dmg', '.rpm', '.msi', '.run', '.bin',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1', '.psd1',
  '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.cgi'
];

const DANGEROUS_MIME_TYPES = [
  'application/x-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-winexe',
  'application/x-javascript',
  'text/javascript',
  'application/javascript',
  'text/x-php',
  'application/x-php',
  'text/x-python',
  'application/x-python-code',
  'application/x-shellscript'
];

// Suspicious patterns in file content
const SUSPICIOUS_PATTERNS = [
  // Script tags
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  // PHP tags
  /<\?php[\s\S]*?\?>/gi,
  // ASP tags
  /<%[\s\S]*?%>/gi,
  // JavaScript protocols
  /javascript:/gi,
  // Data URLs with scripts
  /data:.*script/gi,
  // Common malware signatures
  /eval\s*\(/gi,
  /exec\s*\(/gi,
  /system\s*\(/gi,
  /shell_exec\s*\(/gi,
  /passthru\s*\(/gi
];

/**
 * Validate file signature against MIME type
 */
export function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  try {
    const signatures = FILE_SIGNATURES[mimeType as keyof typeof FILE_SIGNATURES];
    
    if (!signatures) {
      logger.warn('No signature validation available for MIME type:', mimeType);
      return true; // Allow if no signature defined
    }

    // Check if buffer matches any of the valid signatures
    for (const signature of signatures) {
      if (buffer.length >= signature.length) {
        const match = signature.every((byte, index) => buffer[index] === byte);
        if (match) {
          return true;
        }
      }
    }

    logger.warn('File signature validation failed:', {
      mimeType,
      bufferStart: Array.from(buffer.slice(0, 16)),
      expectedSignatures: signatures
    });

    return false;
  } catch (error) {
    logger.error('Error validating file signature:', error);
    return false;
  }
}

/**
 * Check for dangerous file extensions
 */
export function checkDangerousExtension(filename: string): boolean {
  try {
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return DANGEROUS_EXTENSIONS.includes(extension);
  } catch (error) {
    logger.error('Error checking file extension:', error);
    return true; // Err on the side of caution
  }
}

/**
 * Check for dangerous MIME types
 */
export function checkDangerousMimeType(mimeType: string): boolean {
  try {
    return DANGEROUS_MIME_TYPES.includes(mimeType.toLowerCase());
  } catch (error) {
    logger.error('Error checking MIME type:', error);
    return true; // Err on the side of caution
  }
}

/**
 * Scan file content for suspicious patterns
 */
export function scanForSuspiciousContent(buffer: Buffer): {
  isSuspicious: boolean;
  patterns: string[];
} {
  try {
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10240)); // Check first 10KB
    const foundPatterns: string[] = [];

    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        foundPatterns.push(pattern.source);
      }
    }

    return {
      isSuspicious: foundPatterns.length > 0,
      patterns: foundPatterns
    };
  } catch (error) {
    logger.error('Error scanning file content:', error);
    return {
      isSuspicious: true,
      patterns: ['scan_error']
    };
  }
}

/**
 * Validate file size limits
 */
export function validateFileSize(
  size: number,
  maxSize: number,
  fileType: 'image' | 'document' | 'video' | 'audio' = 'image'
): boolean {
  try {
    // Type-specific size limits (in bytes)
    const typeLimits = {
      image: 15 * 1024 * 1024, // 15MB
      document: 10 * 1024 * 1024, // 10MB
      video: 100 * 1024 * 1024, // 100MB
      audio: 20 * 1024 * 1024 // 20MB
    };

    const typeLimit = typeLimits[fileType];
    const effectiveLimit = Math.min(maxSize, typeLimit);

    if (size > effectiveLimit) {
      logger.warn('File size exceeds limit:', {
        size,
        maxSize,
        typeLimit,
        effectiveLimit,
        fileType
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error validating file size:', error);
    return false;
  }
}

/**
 * Check for embedded files or polyglot attacks
 */
export function checkForEmbeddedFiles(buffer: Buffer): boolean {
  try {
    // Look for multiple file signatures in the same buffer
    const signatures = Object.values(FILE_SIGNATURES).flat();
    let signatureCount = 0;

    for (let i = 0; i < buffer.length - 8; i++) {
      for (const signature of signatures) {
        if (signature.length <= buffer.length - i) {
          const match = signature.every((byte, index) => buffer[i + index] === byte);
          if (match) {
            signatureCount++;
            if (signatureCount > 1) {
              logger.warn('Multiple file signatures detected - possible polyglot attack');
              return true;
            }
          }
        }
      }
    }

    return false;
  } catch (error) {
    logger.error('Error checking for embedded files:', error);
    return true; // Err on the side of caution
  }
}

/**
 * Comprehensive file security validation
 */
export async function performSecurityValidation(
  file: Express.Multer.File
): Promise<{
  isSecure: boolean;
  issues: string[];
  warnings: string[];
}> {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. Check dangerous extensions
    if (checkDangerousExtension(file.originalname)) {
      issues.push('Dangerous file extension detected');
    }

    // 2. Check dangerous MIME types
    if (checkDangerousMimeType(file.mimetype)) {
      issues.push('Dangerous MIME type detected');
    }

    // 3. Validate file signature
    if (!validateFileSignature(file.buffer, file.mimetype)) {
      issues.push('File signature does not match MIME type');
    }

    // 4. Scan for suspicious content
    const contentScan = scanForSuspiciousContent(file.buffer);
    if (contentScan.isSuspicious) {
      issues.push(`Suspicious content patterns detected: ${contentScan.patterns.join(', ')}`);
    }

    // 5. Check for embedded files
    if (checkForEmbeddedFiles(file.buffer)) {
      warnings.push('Multiple file signatures detected - possible polyglot file');
    }

    // 6. Validate file size
    const fileType = file.mimetype.startsWith('image/') ? 'image' :
                    file.mimetype.startsWith('video/') ? 'video' :
                    file.mimetype.startsWith('audio/') ? 'audio' : 'document';
    
    if (!validateFileSize(file.size, file.size, fileType)) {
      issues.push('File size exceeds security limits');
    }

    // 7. Check filename for suspicious characters
    if (/[<>:"|?*\x00-\x1f]/.test(file.originalname)) {
      warnings.push('Filename contains suspicious characters');
    }

    // 8. Check for excessively long filename
    if (file.originalname.length > 255) {
      issues.push('Filename is excessively long');
    }

    const isSecure = issues.length === 0;

    if (!isSecure) {
      logger.warn('File security validation failed:', {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        issues,
        warnings
      });
    }

    return {
      isSecure,
      issues,
      warnings
    };

  } catch (error) {
    logger.error('Error during security validation:', error);
    return {
      isSecure: false,
      issues: ['Security validation error'],
      warnings: []
    };
  }
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  try {
    // Remove path separators and dangerous characters
    let sanitized = filename.replace(/[<>:"|?*\x00-\x1f]/g, '');
    
    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
    
    // Limit length
    if (sanitized.length > 255) {
      const extension = sanitized.substring(sanitized.lastIndexOf('.'));
      const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
      sanitized = nameWithoutExt.substring(0, 255 - extension.length) + extension;
    }
    
    // Ensure filename is not empty
    if (!sanitized) {
      sanitized = 'file';
    }
    
    return sanitized;
  } catch (error) {
    logger.error('Error sanitizing filename:', error);
    return 'file';
  }
}

/**
 * Generate secure random filename
 */
export function generateSecureFilename(originalFilename: string): string {
  try {
    const extension = originalFilename.substring(originalFilename.lastIndexOf('.'));
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    
    return `${timestamp}_${random}${extension}`;
  } catch (error) {
    logger.error('Error generating secure filename:', error);
    return `${Date.now()}_file`;
  }
}

/**
 * Check if file type is allowed for specific context
 */
export function isFileTypeAllowed(
  mimeType: string,
  context: 'avatar' | 'property' | 'message' | 'document'
): boolean {
  const allowedTypes = {
    avatar: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    property: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    message: [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4', 'video/quicktime', 'video/webm',
      'audio/mpeg', 'audio/wav', 'audio/ogg'
    ],
    document: [
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'text/csv'
    ]
  };

  return allowedTypes[context].includes(mimeType);
}

export default {
  validateFileSignature,
  checkDangerousExtension,
  checkDangerousMimeType,
  scanForSuspiciousContent,
  validateFileSize,
  checkForEmbeddedFiles,
  performSecurityValidation,
  sanitizeFilename,
  generateSecureFilename,
  isFileTypeAllowed
};
