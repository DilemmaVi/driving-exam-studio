const STATIC_DOMAIN = "https://file.yxjky.com";

export function getStaticUrl(value?: string | null): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.replace(/^\/+/, "");
  return `${STATIC_DOMAIN}/${path}`;
}
