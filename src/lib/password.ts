import { randomBytes, scryptSync } from "crypto";

export const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");

export function newPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return { salt, passwordHash: hashPassword(password, salt) };
}
