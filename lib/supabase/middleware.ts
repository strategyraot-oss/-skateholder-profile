import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

/** หน้าที่เข้าได้โดยไม่ต้องเข้าสู่ระบบ */
const PUBLIC = ["/login", "/register", "/forgot-password", "/auth/", "/setup"];
/** หน้าที่ผู้ที่เข้าสู่ระบบแล้วไม่ต้องเห็น */
const GUEST_ONLY = ["/login", "/register", "/forgot-password"];

const match = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : p + "/"));

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const env = supabaseEnv();

  // ยังไม่ได้ตั้งค่า Supabase: พาไปหน้าแนะนำการตั้งค่า แทนการ error ทั้งเว็บ
  if (!env) {
    if (path === "/setup") return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  let user = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch {
    user = null; // เชื่อมต่อ Supabase ไม่ได้ชั่วคราว ให้ถือว่ายังไม่เข้าสู่ระบบ
  }

  const redirect = (to: string, keepNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = keepNext ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user && !match(path, PUBLIC)) return redirect("/login", path !== "/");
  if (user && match(path, GUEST_ONLY)) return redirect("/dashboard");
  return response;
}
