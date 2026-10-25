const pages = {
  consents: "marketing.consents",
  brands: "marketing.brands",
  campaigns: "marketing.campaigns",
  emailCampaigns: "marketing.email-campaigns",
  conversations: "marketing.conversations",
  contents: "marketing.contents",
  captures: "marketing.captures",
  submissions: "marketing.submissions",
  connections: "marketing.connections",
  leads: "marketing.leads",
  qualifications: "marketing.qualifications",
  conversions: "marketing.conversions",
  outcomes: "marketing.outcomes",
  followups: "marketing.followups"
} as const;

export type MarketingNavigationItem = {
  path: string;
  label: string;
  icon?: string;
  page: string;
};

export const marketingNavigationItems: MarketingNavigationItem[] = [
  { path: "/app/marketing/brands", label: "Brands", page: "marketing.brands" },
  { path: "/app/marketing/campaigns", label: "Campaigns", page: "marketing.campaigns" },
  {
    path: "/app/marketing/email-campaigns",
    label: "Email Campaigns",
    icon: "Mail",
    page: "marketing.email-campaigns"
  },
  {
    path: "/app/marketing/conversations",
    label: "Conversations",
    icon: "MessageSquare",
    page: "marketing.conversations"
  },
  {
    path: "/app/marketing/contents",
    label: "Content",
    icon: "FileText",
    page: "marketing.contents"
  },
  { path: "/app/marketing/captures", label: "Captures", page: "marketing.captures" },
  { path: "/app/marketing/submissions", label: "Submissions", page: "marketing.submissions" },
  { path: "/app/marketing/leads", label: "Leads", page: "marketing.leads" },
  {
    path: "/app/marketing/qualifications",
    label: "Qualifications",
    page: "marketing.qualifications"
  },
  { path: "/app/marketing/conversions", label: "Conversions", page: "marketing.conversions" },
  { path: "/app/marketing/outcomes", label: "Outcomes", page: "marketing.outcomes" },
  { path: "/app/marketing/followups", label: "Follow-ups", page: "marketing.followups" },
  { path: "/app/marketing/connections", label: "Connections", page: "marketing.connections" },
  { path: "/app/marketing/consents", label: "Consents", page: "marketing.consents" }
];

export function marketingPageFromPath(pathname: string) {
  if (pathname === "/app/marketing" || pathname === "/app/marketing/") return pages.brands;
  const match =
    /^\/app\/marketing\/(brands|campaigns|email-campaigns|conversations|contents|captures|submissions|connections|consents|leads|qualifications|conversions|outcomes|followups|follow-ups)\/?$/.exec(
      pathname
    );
  if (!match) return null;
  const rawKey = match[1];
  const key = rawKey === "follow-ups" ? "followups" : rawKey === "email-campaigns" ? "emailCampaigns" : rawKey;
  return pages[key as keyof typeof pages] ?? null;
}
