import { faceReviewRequired } from "./faceverify";
import { actorOf, audit } from "./audit";
import "server-only";
import { randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HOME } from "./nav";
import { DB, User, readDB, withDB } from "./db";
import { hashPassword } from "./password";
import type { RegistrationData } from "./registration";
import { validateStep } from "./registration";
import { BusinessError } from "./services";

export const SESSION_COOKIE = "kratos_session";
const SESSION_DAYS = 7;

export type PublicUser = Omit<User, "passwordHash" | "salt" | "documents" | "faceDescriptor">;

export function toPublic(user: User): PublicUser {
  // El descriptor facial es dato biométrico sensible: nunca sale al cliente.
  const { passwordHash, salt, documents, faceDescriptor, ...rest } = user;
  void passwordHash;
  void salt;
  void documents;
  void faceDescriptor;
  return rest;
}

const hash = hashPassword;

function checkPassword(user: User, password: string) {
  const a = Buffer.from(hash(password, user.salt), "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function startSession(db: DB, userId: string) {
  const token = randomBytes(32).toString("hex");
  db.sessions.push({ token, userId, createdAt: Date.now() });
  return token;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

/** Valida que la cuenta se pueda crear (antes de guardar archivos). */
export function checkRegistration(db: DB, d: RegistrationData) {
  for (const step of [0, 1, 3]) {
    const error = validateStep(step, d);
    if (error) throw new BusinessError(error);
  }
  const email = d.email.trim().toLowerCase();
  if (db.users.some((u) => u.email === email)) throw new BusinessError("Ya existe una cuenta con ese correo");
  if (db.users.some((u) => u.cedula === d.cedula.trim())) throw new BusinessError("Ya existe una cuenta con ese documento");
}

export function register(
  db: DB,
  d: RegistrationData,
  extra: {
    id: string;
    wallet?: string;
    documents: User["documents"];
    face?: { verification: User["faceVerification"]; descriptor?: string; check?: User["faceCheck"] };
  },
) {
  checkRegistration(db, d);
  const salt = randomBytes(16).toString("hex");
  const firstName = d.firstName.trim();
  const lastName = d.lastName.trim();
  const user: User = {
    id: extra.id,
    role: d.role as User["role"],
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    email: d.email.trim().toLowerCase(),
    cedula: d.cedula.trim(),
    phone: d.phone.trim(),
    nationality: d.nationality,
    age: Number(d.age),
    sex: d.sex,
    address: d.address.trim(),
    salt,
    passwordHash: hash(d.password, salt),
    documents: extra.documents,
    faceVerification: extra.face?.verification ?? "pendiente",
    faceDescriptor: extra.face?.descriptor,
    faceCheck: extra.face?.check,
    createdAt: Date.now(),
  };
  if (d.role === "inversor") {
    user.wallet = extra.wallet;
    user.investorProfile = {
      monthlyIncome: Number(d.investorIncome),
      currency: d.investorCurrency,
      incomeSource: d.investorIncomeSource,
      employment: d.employment as "independiente" | "asalariado",
    };
  } else {
    user.borrowerProfile = {
      incomeSource: d.borrowerIncomeSource,
      monthlyIncomeCop: Number(d.borrowerIncome),
      llaveBreb: d.llaveBreb.trim(),
    };
  }
  db.users.push(user);
  return { user, token: startSession(db, user.id) };
}

export function login(db: DB, emailInput: string, password: string) {
  const email = emailInput?.trim().toLowerCase();
  const user = db.users.find((u) => u.email === email);
  if (!user || !checkPassword(user, password ?? "")) throw new BusinessError("Correo o contraseña incorrectos");
  if (user.faceVerification === "rechazada")
    throw new BusinessError("Tu cuenta fue bloqueada en la verificación de identidad. Si crees que es un error, escríbenos.");
  if (user.suspended) throw new BusinessError("Tu cuenta está suspendida. Si crees que es un error, escríbenos.");
  return { user, token: startSession(db, user.id) };
}

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (token)
    await withDB((db) => {
      const user = userForToken(db, token);
      db.sessions = db.sessions.filter((s) => s.token !== token);
      if (user) audit(db, { category: "acceso", action: "sesion_cerrada", actor: actorOf(user), entity: { type: "usuario", id: user.id }, summary: "Cerró sesión" });
    });
}

function userForToken(db: DB, token: string | undefined) {
  if (!token) return null;
  const session = db.sessions.find((s) => s.token === token);
  if (!session || Date.now() - session.createdAt > SESSION_DAYS * 86_400_000) return null;
  const user = db.users.find((u) => u.id === session.userId) ?? null;
  // Una cuenta rechazada en la verificación facial o suspendida por el operador pierde también las sesiones abiertas
  return user?.faceVerification === "rechazada" || user?.suspended ? null : user;
}

/**
 * Operaciones con dinero (pedir crédito, verificar la llave para el crédito, invertir) exigen la identidad
 * verificada. Con la verificación facial en revisión del operador, la cuenta sirve pero no mueve plata.
 */
export function requireVerifiedIdentity(user: User, action: string) {
  // En la demo (FACE_REVIEW apagado) una verificación en revisión no frena; una rechazada nunca llega aquí (no inicia sesión)
  if (!faceReviewRequired() && user.faceVerification === "pendiente") return;
  if (user.faceVerification !== "aprobada")
    throw new BusinessError(`Tu verificación de identidad está en revisión. Cuando el equipo la apruebe podrás ${action}.`);
}

/** Usuario de la sesión actual (solo lectura), o null. */
export async function currentUser(): Promise<PublicUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = userForToken(await readDB(), token);
  return user ? toPublic(user) : null;
}

/** Devuelve el usuario de la sesión dentro de una transacción de la base, o lanza error 401. */
export async function requireUser(db: DB): Promise<User> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = userForToken(db, token);
  if (!user) throw new UnauthorizedError("Inicia sesión para continuar");
  return user;
}

export class UnauthorizedError extends Error {}

/** Para páginas: exige sesión y uno de los roles; si no, redirige al login o al inicio de su rol. */
export async function requirePageRole(roles: User["role"][], path: string, opts: { needsStudy?: boolean } = {}) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!roles.includes(user.role)) redirect(HOME[user.role]);
  // El acreditado debe hacer su estudio de crédito antes de usar cualquier otra sección
  if (opts.needsStudy && user.role === "acreditado") {
    const db = await readDB();
    if (!db.applicants.some((a) => a.cedula === user.cedula)) redirect("/estudio");
  }
  return user;
}

/** Solo el operador de la plataforma */
export function requireAdmin(user: User) {
  if (user.role !== "admin") throw new ForbiddenError("No tienes acceso a esta sección");
}

export class ForbiddenError extends Error {}

/** Exige que el usuario tenga el rol indicado. */
export function requireRole(user: User, role: User["role"]) {
  if (user.role !== role)
    throw new BusinessError(role === "inversor" ? "Esta sección es para cuentas de inversionista" : "Esta sección es para cuentas de acreditado");
}
