import "server-only";
import bcrypt from "bcryptjs";

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

// Compared against when an email doesn't exist, so login timing doesn't reveal registered emails.
let dummy: string | null = null;
export async function dummyVerify(password: string) {
  dummy ??= await bcrypt.hash("driponza-dummy-password", 12);
  await bcrypt.compare(password, dummy);
  return false;
}
