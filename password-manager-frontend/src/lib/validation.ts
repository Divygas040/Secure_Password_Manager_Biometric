export type FieldErrors = Record<string, string>;
export const USERNAME_PATTERN = '[A-Za-z0-9@.+_\\-]{3,30}';
export const USERNAME_HELP = '3–30 characters. Letters, numbers and @ . + - _ only. No spaces.';
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
const length = (value: string) => Array.from(value).length;

export function validateEmail(value: string): string | undefined {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const atom = /^[-!#$%&'*+/=?^_`{}|~0-9a-z]+(?:\.[-!#$%&'*+/=?^_`{}|~0-9a-z]+)*$/i;
  const quoted = /^"(?:[^"\\\s]|\\[^\r\n])*"$/;
  let validDomain = domain === 'localhost';
  try {
    const host = new URL(`http://${domain}`).hostname;
    const labels = host.split('.');
    validDomain ||= !/[\s/:?#@]/.test(domain) && labels.length > 1 &&
      labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) &&
      /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/i.test(labels[labels.length - 1]);
  } catch { /* Invalid domain; backend remains authoritative for delivery. */ }
  if (!email || email.length > 254 || at < 1 || (!atom.test(local) && !quoted.test(local)) || !validDomain) {
    return 'Enter a valid email address, up to 254 characters.';
  }
}
export function validateSignup(values: { username: string; phone: string; email: string; password: string; terms?: boolean }): FieldErrors {
  const errors: FieldErrors = {};
  if (!/^[A-Za-z0-9@.+_-]{3,30}$/.test(values.username.trim())) errors.username = USERNAME_HELP;
  if (!/^[0-9]{10,15}$/.test(values.phone) || /\s/.test(values.phone)) errors.phone = 'Use 10–15 digits, with no spaces or punctuation.';
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  if (length(values.password) < 12 || length(values.password) > 128) errors.password = 'Use 12–128 characters.';
  if (values.terms === false) errors.terms = 'Please acknowledge the demo limitations.';
  return errors;
}
export function validateLogin(values: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  if (!values.password || length(values.password) > 128) errors.password = 'Enter your password, up to 128 characters.';
  return errors;
}
export function validateVault(values: { domain_name: string; password: string; link: string }): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.domain_name.trim();
  if (!name || length(name) > 255 || /^[\p{C}\p{Z}]+$/u.test(name)) errors.domain_name = 'Enter a visible service or display name, up to 255 characters.';
  if (!values.password || length(values.password) > 4096) errors.password = 'Enter the existing password, up to 4096 characters.';
  const link = values.link.trim();
  if (link) {
    try {
      const url = new URL(link);
      if (!/^https?:\/\//i.test(link) || !['http:', 'https:'].includes(url.protocol) || !url.hostname || /\s/.test(link) || link.length > 200) throw new Error();
    } catch { errors.link = 'Enter a valid http:// or https:// URL, up to 200 characters, or leave it blank.'; }
  }
  return errors;
}
export function validateFaceImage(blob: Blob): string | undefined {
  if (!['image/jpeg', 'image/png'].includes(blob.type) || !blob.size || blob.size > 2 * 1024 * 1024) return 'Use a JPEG or PNG image up to 2 MB.';
}
