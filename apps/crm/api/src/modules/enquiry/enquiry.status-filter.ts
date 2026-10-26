const closed = ["won", "lost", "closed"];
const holds = ["hold-for-approval", "long-hold", "hold-for-spares", "hold-for-job-out"];
const pending = ["open", "reopen", "escalation"];

export function enquiryStatusFilter(filter: string) {
  switch (filter) {
    case "all":
      return null;
    case "active":
      return { codes: closed, exclude: true };
    case "hold":
      return { codes: holds, exclude: false };
    case "pending-group":
      return { codes: pending, exclude: false };
    case "in-progress":
      return { codes: [...holds, ...pending], exclude: false };
    case "closed-group":
      return { codes: closed, exclude: false };
    case "other":
      return { codes: ["new", ...pending, ...holds, ...closed], exclude: true };
    default:
      return { codes: [filter], exclude: false };
  }
}

export function enquiryCountForFilter(
  counts: Array<{ code: string; count: number }>,
  filter: string
) {
  const selection = enquiryStatusFilter(filter);
  return counts.reduce((total, item) => {
    const matches = !selection || selection.codes.includes(item.code) !== selection.exclude;
    return total + (matches ? Number(item.count) : 0);
  }, 0);
}
