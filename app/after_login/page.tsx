// app/after_login/page.tsx
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Alleen échte phones (geen tablets) */
function isPhoneUA(uaRaw: string | null): boolean {
  const ua = (uaRaw || "").toLowerCase();

  // tablets expliciet uitsluiten
  const isIPad = ua.includes("ipad");
  const isAndroidTablet = ua.includes("android") && !ua.includes("mobile");
  const isTablet =
    isIPad ||
    isAndroidTablet ||
    ua.includes("tablet") ||
    ua.includes("kindle") ||
    ua.includes("silk");

  if (isTablet) return false;

  // phones
  const isIphone = ua.includes("iphone") || ua.includes("ipod");
  const isAndroidPhone = ua.includes("android") && ua.includes("mobile");
  const isWindowsPhone = ua.includes("windows phone");

  return isIphone || isAndroidPhone || isWindowsPhone;
}

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

// ⚠️ Server Component (geen "use client")
export default async function Page({ searchParams }: PageProps) {
  // ✅ wacht op headers() en cookies()
  const h = await headers();
  const c = await cookies();

  const ua = h.get("user-agent");

  // 1) personnel_id uit querystring
  let personnelId =
    typeof searchParams?.personnel_id === "string"
      ? searchParams.personnel_id
      : Array.isArray(searchParams?.personnel_id)
      ? searchParams!.personnel_id[0]
      : undefined;

  // 2) anders uit cookie
  if (!personnelId) {
    personnelId = c.get("personnel_id")?.value;
  }

  // 3) doel-URL bouwen met personnel_id
  const params = new URLSearchParams();
  if (personnelId) params.set("personnel_id", personnelId);

  const basePath = isPhoneUA(ua) ? "/calendar_mobile" : "/calendar";
  const to = params.toString() ? `${basePath}?${params.toString()}` : basePath;

  // 4) doorsturen
  redirect(to);
}
