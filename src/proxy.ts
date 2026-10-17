import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/origin";

// Pantallas que requieren sesión. La validación real de la sesión la hacen las API; aquí solo redirigimos.
export function proxy(request: NextRequest) {
  if (request.cookies.has("kratos_session")) return NextResponse.next();
  const url = new URL("/login", publicOrigin(request));
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/inicio", "/estudio", "/movimientos", "/invertir", "/credito", "/mi-credito", "/boveda"],
};
