// The address just typed, for Resend on the Check your email screen. Kept in
// memory only, so it never lands in route params, storage or logs.

let email: string | null = null;

export function setPendingEmail(value: string): void {
  email = value;
}

export function getPendingEmail(): string | null {
  return email;
}
