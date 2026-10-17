import { handle } from "@/lib/api";
import { logout } from "@/lib/auth";

export async function POST() {
  return handle(async () => {
    await logout();
    return { ok: true };
  });
}
