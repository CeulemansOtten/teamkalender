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

export default function Page({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const h = headers();
  const ua = h.get("user-agent");

  // 1) haal personnel_id uit querystring
  let personnelId =
    (typeof searchParams?.personnel_id === "string" && searchParams?.personnel_id) ||
    undefined;

  // 2) zo niet, haal het uit cookie
  if (!personnelId) {
    personnelId = cookies().get("personnel_id")?.value;
  }

  // 3) bouw de doel-URL met personnel_id
  const params = new URLSearchParams();
  if (personnelId) params.set("personnel_id", personnelId);

  const basePath = isPhoneUA(ua) ? "/calendar_mobile" : "/calendar";
  const to = params.toString() ? `${basePath}?${params.toString()}` : basePath;

  redirect(to);
}
