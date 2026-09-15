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

  if (!Number.isInteger(length) || length < 8 || length > 128) throw new Error('Password length must be 8–128.');
  const randomIndex = (max: number) => {
    const buffer = new Uint32Array(1);
    const ceiling = Math.floor(0x100000000 / max) * max;
    do { crypto.getRandomValues(buffer); } while (buffer[0] >= ceiling);
    return buffer[0] % max;
  };
  const groups = [includeUppercase && uppercaseChars, includeLowercase && lowercaseChars,
    includeNumbers && numberChars, includeSymbols && symbolChars].filter((group): group is string => Boolean(group));
  const characters = groups.map(group => group[randomIndex(group.length)]);
  while (characters.length < length) characters.push(charPool[randomIndex(charPool.length)]);
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters.join('');
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