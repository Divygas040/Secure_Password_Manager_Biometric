/**
 * Password Generator Utility
 * Generates strong, secure passwords with configurable options
 */

interface PasswordOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSymbols?: boolean;
}

/**
 * Generates a strong password based on provided options
 * @param options Configuration options for password generation
 * @returns A strong, randomly generated password
 */
export const generateStrongPassword = (options: PasswordOptions = {}): string => {
  const {
    length = 16,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
  } = options;

  // Character sets
  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
  const numberChars = '0123456789';
  const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  // Build character pool based on options
  let charPool = '';
  if (includeUppercase) charPool += uppercaseChars;
  if (includeLowercase) charPool += lowercaseChars;
  if (includeNumbers) charPool += numberChars;
  if (includeSymbols) charPool += symbolChars;

  // Default to lowercase + numbers if nothing selected
  if (charPool === '') {
    charPool = lowercaseChars + numberChars;
  }

  // Generate password
  let password = '';
  let hasRequiredChars = false;

  // Keep generating until we have at least one character from each required set
  while (!hasRequiredChars) {
    password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charPool.length);
      password += charPool[randomIndex];
    }

    // Verify password contains at least one character from each required set
    hasRequiredChars = true;
    
    if (includeUppercase && !new RegExp(`[${uppercaseChars}]`).test(password)) {
      hasRequiredChars = false;
    }
    if (includeLowercase && !new RegExp(`[${lowercaseChars}]`).test(password)) {
      hasRequiredChars = false;
    }
    if (includeNumbers && !new RegExp(`[${numberChars}]`).test(password)) {
      hasRequiredChars = false;
    }
    if (includeSymbols && !new RegExp(`[${symbolChars}]`).test(password)) {
      hasRequiredChars = false;
    }
  }

  return password;
};

/**
 * Evaluates password strength
 * @param password Password to evaluate
 * @returns Score from 0-100
 */
export const evaluatePasswordStrength = (password: string): number => {
  if (!password) return 0;
  
  let score = 0;
  
  // Length contribution (up to 40 points)
  score += Math.min(40, password.length * 2.5);
  
  // Character variety contribution (up to 60 points)
  if (/[A-Z]/.test(password)) score += 15; // Uppercase
  if (/[a-z]/.test(password)) score += 10; // Lowercase
  if (/[0-9]/.test(password)) score += 15; // Numbers
  if (/[^A-Za-z0-9]/.test(password)) score += 20; // Symbols
  
  return Math.min(100, score);
};

/**
 * Gets a textual representation of password strength
 * @param score Numeric score from evaluatePasswordStrength
 * @returns Text description of password strength
 */
export const getPasswordStrengthLabel = (score: number): string => {
  if (score >= 80) return 'Very Strong';
  if (score >= 60) return 'Strong';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'Weak';
  return 'Very Weak';
};

/**
 * Gets color class for password strength
 * @param score Numeric score from evaluatePasswordStrength
 * @returns Tailwind CSS color class
 */
export const getPasswordStrengthColor = (score: number): string => {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-blue-500';
  if (score >= 40) return 'text-yellow-500';
  if (score >= 20) return 'text-orange-500';
  return 'text-red-500';
}; 