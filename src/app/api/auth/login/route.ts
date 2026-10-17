import { handle } from "@/lib/api";
import { login, setSessionCookie, toPublic } from "@/lib/auth";
import { withDB } from "@/lib/db";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  return handle(async () => {
    const { user, token } = await withDB((db) => login(db, String(email ?? ""), String(password ?? "")));
    await setSessionCookie(token);
    return toPublic(user);
  });
}
