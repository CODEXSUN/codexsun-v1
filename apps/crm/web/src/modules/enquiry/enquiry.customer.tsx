import { CrmStatusBadge } from "../../crm-colors";
import { listEnquiryPage } from "./enquiry.services";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@codexsun/ui/components/button";
import { WorkspaceTableEmptyState } from "@codexsun/ui/workspace/table";
import { listCustomerTasks } from "../task";
import { WorkspaceDetailTable, WorkspaceShowCard } from "@codexsun/ui/workspace/show";
import { formatDate, formatScheduleDate } from "./enquiry.view-utils";
import type { EnquiryRecord } from "./enquiry.types";

export function EnquiryCustomer({
  record,
  mobile,
  active = true
}: {
  record: EnquiryRecord;
  mobile: string | null;
  active?: boolean;
}) {
  return (
    <div className="space-y-4 p-4">
      <WorkspaceShowCard title="Customer">
        <WorkspaceDetailTable
          rows={[
            [
              "Customer",
              record.contactId ? (
                <a
                  className="font-medium text-primary hover:underline"
                  href={`/app/crm/contacts/${record.contactId}/show`}
                >
                  {record.contactName ?? record.capturedName ?? "Open contact"}
                </a>
              ) : (
                (record.capturedName ?? "—")
              )
            ],
            ["Mobile", mobile || "—"],
            ["Enquiry date", formatDate(record.enquiredAt)],
            ["Schedule date", formatScheduleDate(record.dueDate)]
          ]}
        />
      </WorkspaceShowCard>
      <CustomerEnquiries
        key={`enquiries-${record.contactId ?? "no-contact"}`}
        contactId={record.contactId}
        active={active}
      />
      <CustomerTasks
        key={record.contactId ?? "no-contact"}
        contactId={record.contactId}
        active={active}
      />
    </div>
  );
}

function CustomerTasks({ contactId, active }: { contactId: number | null; active: boolean }) {
  const [page, setPage] = useState(1);
  const tasks = useQuery({
    queryKey: ["crm", "tasks", "customer", contactId, page],
    queryFn: () => listCustomerTasks(contactId!, page),
    enabled: active && contactId !== null,
    refetchInterval: 10000
  });
  const pages = Math.max(1, Math.ceil((tasks.data?.total ?? 0) / 100));
  return (
    <WorkspaceShowCard title={`Existing tasks${tasks.data ? ` · ${tasks.data.total}` : ""}`}>
      {!contactId ? (
        <p className="text-sm text-muted-foreground">
          Link a customer to see their existing tasks.
        </p>
      ) : tasks.isError ? (
        <div role="alert" className="text-sm text-destructive">
          {tasks.error.message}{" "}
          <Button variant="outline" size="sm" onClick={() => void tasks.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-md border border-border/70">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-24 px-3 py-2">Task #</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">List in</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.data?.items.map((task) => (
                  <tr key={task.id} className="border-t border-border/70">
                    <td className="px-3 py-2">
                      <a
                        href={`/app/crm/tasks/${task.id}`}
                        className="text-primary hover:underline"
                      >
                        #{task.id}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <a href={`/app/crm/tasks/${task.id}`} className="hover:underline">
                        {task.title}
                      </a>
                    </td>
                    <td className="px-3 py-2">{task.listIn || "Unlisted"}</td>
                    <td className="px-3 py-2">
                      <CrmStatusBadge code={task.status} label={task.statusName} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tasks.isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Loading tasks…</p>
            ) : !tasks.data?.items.length ? (
              <WorkspaceTableEmptyState>No tasks found for this customer.</WorkspaceTableEmptyState>
            ) : null}
          </div>
          {pages > 1 ? (
            <div className="mt-3 flex items-center justify-end gap-3 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </WorkspaceShowCard>
  );
}

function CustomerEnquiries({ contactId, active }: { contactId: number | null; active: boolean }) {
  const [page, setPage] = useState(1);
  const enquiries = useQuery({
    queryKey: ["crm", "enquiries", "customer", contactId, page],
    queryFn: () =>
      listEnquiryPage({
        contactId: contactId!,
        scope: "all",
        page,
        pageSize: 100,
        search: "",
        filter: "all"
      }),
    enabled: active && contactId !== null,
    refetchInterval: 10000
  });
  const pages = Math.max(1, Math.ceil((enquiries.data?.total ?? 0) / 100));
  return (
    <WorkspaceShowCard
      title={`Existing enquiries${enquiries.data ? ` · ${enquiries.data.total}` : ""}`}
    >
      {!contactId ? (
        <p className="text-sm text-muted-foreground">
          Link a customer to see their existing enquiries.
        </p>
      ) : enquiries.isError ? (
        <div role="alert" className="text-sm text-destructive">
          {enquiries.error.message}{" "}
          <Button variant="outline" size="sm" onClick={() => void enquiries.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="workspace-scroll overflow-x-auto rounded-md border border-border/70">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-24 px-3 py-2">Enquiry #</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">List in</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.data?.items.map((enquiry) => (
                  <tr key={enquiry.id} className="border-t border-border/70">
                    <td className="px-3 py-2">
                      <a
                        href={`/app/crm/enquiries/${enquiry.id}`}
                        className="text-primary hover:underline"
                      >
                        #{enquiry.enquiryNo}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <a href={`/app/crm/enquiries/${enquiry.id}`} className="hover:underline">
                        {enquiry.title}
                      </a>
                    </td>
                    <td className="px-3 py-2">{enquiry.listIn || "Unlisted"}</td>
                    <td className="px-3 py-2">
                      <CrmStatusBadge code={enquiry.status} label={enquiry.statusName} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {enquiries.isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Loading enquiries…</p>
            ) : !enquiries.data?.items.length ? (
              <WorkspaceTableEmptyState>
                No enquiries found for this customer.
              </WorkspaceTableEmptyState>
            ) : null}
          </div>
          {pages > 1 ? (
            <div className="mt-3 flex items-center justify-end gap-3 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </WorkspaceShowCard>
  );
}
