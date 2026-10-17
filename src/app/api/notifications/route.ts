import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { now, withDB } from "@/lib/db";
import { notificationsFor } from "@/lib/notifications";

export async function GET() {
  return handle(() =>
    withDB(async (db) => {
      const user = await requireUser(db);
      const seenAt = user.notificationsSeenAt ?? 0;
      const items = notificationsFor(db, user).map((n) => ({ ...n, unread: n.at > seenAt }));
      return { items, unread: items.filter((n) => n.unread).length };
    }),
  );
}

/** Marca todas como vistas */
export async function POST() {
  return handle(() =>
    withDB(async (db) => {
      const user = await requireUser(db);
      user.notificationsSeenAt = now(db);
      return { ok: true };
    }),
  );
}
