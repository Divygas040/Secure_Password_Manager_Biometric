// UI sequencing only. Every authorization decision is enforced again by Django.
export type EnrollmentStep = 'closed' | 'confirm-password' | 'verify-current-face' | 'capture';
export type EnrollmentEvent = 'password-confirmed' | 'face-verified' | 'completed' | 'cancelled';
export const startEnrollment = (faceEnrolled: boolean): EnrollmentStep => faceEnrolled ? 'verify-current-face' : 'confirm-password';
export function advanceEnrollment(step: EnrollmentStep, event: EnrollmentEvent): EnrollmentStep {
  if (event === 'cancelled' || event === 'completed') return 'closed';
  if (step === 'confirm-password' && event === 'password-confirmed') return 'capture';
  if (step === 'verify-current-face' && event === 'face-verified') return 'capture';
  return step;
}
export const NO_FACE_MESSAGE = 'Set up face verification before unlocking your vault.';
export function validateCurrentPassword(password: string): string | undefined {
  if (!password || Array.from(password).length > 128) return 'Enter your current password, up to 128 characters.';
}

// Keep the sensitive-value lifecycle in one place, including rejection and retry.
// The guard holds only a boolean, never the password or authorization proof.
export async function runPasswordConfirmation(
  password: string, pending: { current: boolean },
  send: (password: string) => Promise<unknown>, clearPassword: () => void,
): Promise<boolean> {
  if (pending.current) return false;
  pending.current = true;
  try { await send(password); return true; }
  finally { clearPassword(); pending.current = false; }
}
