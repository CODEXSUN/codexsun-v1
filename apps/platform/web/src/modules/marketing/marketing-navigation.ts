const pages = {
  consents: "marketing.consents",
  brands: "marketing.brands",
  campaigns: "marketing.campaigns",
  captures: "marketing.captures",
  submissions: "marketing.submissions",
  connections: "marketing.connections",
  leads: "marketing.leads",
  qualifications: "marketing.qualifications",
  conversions: "marketing.conversions",
  outcomes: "marketing.outcomes",
  followups: "marketing.followups"
} as const;

export function marketingPageFromPath(pathname: string) {
  if (pathname === "/app/marketing" || pathname === "/app/marketing/") return pages.brands;
  const match =
    /^\/app\/marketing\/(brands|campaigns|captures|submissions|connections|consents|leads|qualifications|conversions|outcomes|followups|follow-ups)\/?$/.exec(
      pathname
    );
  if (!match) return null;
  const key = match[1] === "follow-ups" ? "followups" : match[1];
  return pages[key as keyof typeof pages] ?? null;
}
