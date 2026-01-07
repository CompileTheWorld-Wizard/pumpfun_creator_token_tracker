/**
 * Console sanitizer to prevent binary data corruption in terminal output
 * Intercepts console methods and sanitizes binary/non-printable characters
 */

/**
 * Check if a string contains binary/non-printable characters
 */
function containsBinaryData(str: string): boolean {
  // Check for non-printable ASCII characters (except common whitespace)
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    // Allow printable ASCII (32-126) and common whitespace (9, 10, 13)
    if (charCode < 9 || (charCode > 13 && charCode < 32) || charCode > 126) {
      return true;
    }
  }
  return false;
}

/**
 * Sanitize a string by replacing binary data with hex representation
 */
function sanitizeString(str: string): string {
  if (!containsBinaryData(str)) {
    return str;
  }

  // Replace binary characters with their hex representation
  let sanitized = '';
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    if (charCode >= 32 && charCode <= 126) {
      // Printable ASCII
      sanitized += str[i];
    } else if (charCode === 9 || charCode === 10 || charCode === 13) {
      // Common whitespace (tab, newline, carriage return)
      sanitized += str[i];
    } else {
      // Non-printable character - replace with hex
      sanitized += `\\x${charCode.toString(16).padStart(2, '0')}`;
    }
  }
  return sanitized;
}

/**
 * Sanitize arguments before logging
 */
function sanitizeArgs(args: any[]): any[] {
  return args.map(arg => {
    if (typeof arg === 'string') {
      return sanitizeString(arg);
    } else if (arg instanceof Error) {
      // For errors, sanitize the message
      const error = arg as any;
      if (error.message && typeof error.message === 'string') {
        error.message = sanitizeString(error.message);
      }
      if (error.stack && typeof error.stack === 'string') {
        error.stack = sanitizeString(error.stack);
      }
      return arg;
    } else if (Buffer.isBuffer(arg)) {
      // Convert Buffer to hex string representation
      return `[Buffer: ${arg.toString('hex')}]`;
    } else if (arg instanceof Uint8Array) {
      // Convert Uint8Array to hex string representation
      return `[Uint8Array: ${Array.from(arg).map(b => b.toString(16).padStart(2, '0')).join('')}]`;
    } else if (typeof arg === 'object' && arg !== null) {
      // Recursively sanitize object properties
      try {
        const jsonStr = JSON.stringify(arg);
        if (containsBinaryData(jsonStr)) {
          return sanitizeString(jsonStr);
        }
        return arg;
      } catch {
        // If JSON.stringify fails, try to sanitize string representation
        return sanitizeString(String(arg));
      }
    }
    return arg;
  });
}

/**
 * Filter out or suppress specific error messages that contain binary data
 */
function shouldSuppressMessage(message: string): boolean {
  // Suppress "Error decoding instruction by idl" messages that contain binary data
  // These are noisy errors from the ladybug-sdk library when it can't decode instructions
  if (message.includes('Error decoding instruction by idl')) {
    return true;
  }
  // Also suppress messages that are mostly binary data (more than 50% non-printable)
  let nonPrintableCount = 0;
  for (let i = 0; i < message.length; i++) {
    const charCode = message.charCodeAt(i);
    if (charCode < 9 || (charCode > 13 && charCode < 32) || charCode > 126) {
      nonPrintableCount++;
    }
  }
  if (message.length > 0 && nonPrintableCount / message.length > 0.5) {
    return true;
  }
  return false;
}

/**
 * Initialize console sanitizer
 * This should be called early in the application startup
 */
export function initializeConsoleSanitizer(): void {
  // Store original console methods
  const originalError = console.error;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  // Override console.error
  console.error = (...args: any[]) => {
    // Check all arguments for suppression patterns before sanitizing
    const message = args.map(arg => String(arg || '')).join(' ');
    if (shouldSuppressMessage(message)) {
      return; // Silently ignore
    }
    
    const sanitized = sanitizeArgs(args);
    originalError.apply(console, sanitized);
  };

  // Override console.log
  console.log = (...args: any[]) => {
    const sanitized = sanitizeArgs(args);
    originalLog.apply(console, sanitized);
  };

  // Override console.warn
  console.warn = (...args: any[]) => {
    const sanitized = sanitizeArgs(args);
    originalWarn.apply(console, sanitized);
  };

  // Override console.info
  console.info = (...args: any[]) => {
    const sanitized = sanitizeArgs(args);
    originalInfo.apply(console, sanitized);
  };

  // Also handle process.stderr.write and process.stdout.write
  // These are often used by libraries to write directly to stderr/stdout
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = function(chunk: any, encoding?: any, callback?: any) {
    let str: string;
    if (typeof chunk === 'string') {
      str = chunk;
    } else if (Buffer.isBuffer(chunk)) {
      str = chunk.toString('utf8');
    } else {
      return originalStderrWrite(chunk, encoding, callback);
    }
    
    // Check for suppression before sanitizing
    if (shouldSuppressMessage(str)) {
      return true; // Suppress
    }
    
    const sanitized = sanitizeString(str);
    if (Buffer.isBuffer(chunk)) {
      return originalStderrWrite(Buffer.from(sanitized, 'utf8'), encoding, callback);
    }
    return originalStderrWrite(sanitized, encoding, callback);
  };

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = function(chunk: any, encoding?: any, callback?: any) {
    if (typeof chunk === 'string') {
      const sanitized = sanitizeString(chunk);
      return originalStdoutWrite(sanitized, encoding, callback);
    } else if (Buffer.isBuffer(chunk)) {
      const str = chunk.toString('utf8');
      const sanitized = sanitizeString(str);
      return originalStdoutWrite(Buffer.from(sanitized, 'utf8'), encoding, callback);
    }
    return originalStdoutWrite(chunk, encoding, callback);
  };
}

