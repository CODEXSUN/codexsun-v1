import assert from "node:assert/strict";
import { test } from "node:test";
import { EnquiryService, type EnquiryRelations } from "./enquiry.service.js";
import { AppError } from "@codexsun/framework/errors";
import type { EnquiryRepository } from "./enquiry.repository.js";
import type { EnquiryInput, EnquiryListOptions, EnquiryRecord } from "./enquiry.types.js";

const statuses = new Map([
  [1, { name: "New", code: "new" }],
  [2, { name: "Open", code: "open" }],
  [3, { name: "Won", code: "won" }],
  [4, { name: "Re-open", code: "reopen" }],
  [5, { name: "Closed", code: "closed" }]
]);

function record(statusId = 2): EnquiryRecord {
  return {
    id: 7,
    uuid: "12345678",
    enquiryNo: 7,
    title: "Test enquiry",
    description: "Test enquiry",
    contactId: 1,
    contactName: "Customer",
    capturedName: "Customer",
    capturedEmail: null,
    capturedPhone: null,
    source: "manual",
    sourceReference: null,
    listInId: null,
    listIn: null,
    statusId,
    status: statuses.get(statusId)?.code ?? "open",
    statusName: statuses.get(statusId)?.name ?? "Open",
    priorityId: 1,
    priority: "normal",
    priorityName: "Normal",
    assignedUserId: 2,
    enquiredAt: "2026-10-07T00:00:00.000Z",
    dueDate: null,
    closedReason: statusId === 3 ? "Customer accepted" : null,
    createdBy: "creator@example.com",
    createdAt: "2026-10-07T00:00:00.000Z",
    updatedAt: "2026-10-07T00:00:00.000Z"
  };
}

const relations: EnquiryRelations = {
  contact: async () => ({ name: "Customer" }),
  resolveOrCreateCustomer: async () => ({ id: 1, name: "Customer" }),
  user: async () => ({ name: "User" }),
  listIn: async () => ({ name: "List" }),
  status: async (id) => statuses.get(id) ?? null,
  priority: async () => ({ name: "Normal" })
};

test("a list page resolves repeated contacts once without retaining them across requests", async () => {
  let lookups = 0;
  const repository = {
    listPage: async () => ({
      items: [record(), { ...record(), id: 8 }],
      total: 2,
      statusCounts: []
    })
  } as unknown as EnquiryRepository;
  const service = new EnquiryService(
    repository,
    {
      ...relations,
      contact: async () => ({ name: `Customer revision ${++lookups}` })
    },
    { actorEmail: "creator@example.com", actorUserId: 2, canViewAll: false }
  );
  const options = { scope: "all" as const, page: 1, pageSize: 25, search: "", filter: "all" };
  const first = await service.listPage(options);
  assert.equal(lookups, 1);
  assert.equal(first.items[1]?.contactName, "Customer revision 1");
  const second = await service.listPage(options);
  assert.equal(lookups, 2);
  assert.equal(second.items[0]?.contactName, "Customer revision 2");
});

test("new enquiries accept only ten-digit mobile numbers when provided", async () => {
  let created = 0;
  const repository = {
    create: async (input: EnquiryInput) => {
      created += 1;
      return { ...record(), ...input } as EnquiryRecord;
    }
  } as unknown as EnquiryRepository;
  const service = new EnquiryService(repository, relations, {
    actorEmail: "creator@example.com",
    actorUserId: 2,
    canViewAll: false
  });

  await assert.rejects(
    service.create({ ...record(), capturedPhone: "9858545855225" }, "creator@example.com"),
    /10-digit mobile number/i
  );
  assert.equal(created, 0);
  await service.create({ ...record(), capturedPhone: "9976222059" }, "creator@example.com");
  assert.equal(created, 1);
});

test("mobile enquiries use the local create contract", async () => {
  let createArgumentCount = 0;
  const repository = {
    create: async (...args: unknown[]) => {
      createArgumentCount = args.length;
      return record();
    }
  } as unknown as EnquiryRepository;
  const service = new EnquiryService(repository, relations, {
    actorEmail: "mobile@example.com",
    actorUserId: 2,
    canViewAll: false
  });

  await service.create(
    { ...record(), source: "mobile", capturedPhone: "9976222059" },
    "mobile@example.com"
  );
  assert.equal(createArgumentCount, 3);
});

test("mobile enquiries can be saved without creating a blank customer", async () => {
  let saved: EnquiryInput | undefined;
  let contactResolutionCalls = 0;
  const repository = {
    create: async (
      input: EnquiryInput,
      _actor: string,
      resolveContact?: (tx: never) => Promise<EnquiryInput>
    ) => {
      saved = resolveContact ? await resolveContact({} as never) : input;
      return { ...record(), ...saved } as EnquiryRecord;
    }
  } as unknown as EnquiryRepository;
  const service = new EnquiryService(
    repository,
    {
      ...relations,
      resolveOrCreateCustomer: async () => {
        contactResolutionCalls += 1;
        return { id: 2, name: "Should not be created" };
      }
    },
    { actorEmail: "mobile@example.com", actorUserId: 2, canViewAll: false }
  );

  await service.create(
    {
      ...record(),
      source: "mobile",
      contactId: null,
      capturedName: null,
      capturedPhone: null
    },
    "mobile@example.com"
  );

  assert.equal(saved?.contactId, null);
  assert.equal(saved?.capturedName, null);
  assert.equal(saved?.capturedPhone, null);
  assert.equal(contactResolutionCalls, 0);
});

test("mobile enquiry title, details, and new customer name are stored as plain text", async () => {
  let saved: EnquiryInput | undefined;
  const repository = {
    create: async (
      input: EnquiryInput,
      _actor: string,
      resolveContact?: (tx: never) => Promise<EnquiryInput>
    ) => {
      saved = resolveContact ? await resolveContact({} as never) : input;
      return { ...record(), ...saved } as EnquiryRecord;
    }
  } as unknown as EnquiryRepository;
  const service = new EnquiryService(repository, relations, {
    actorEmail: "mobile@example.com",
    actorUserId: 2,
    canViewAll: false
  });

  await service.create(
    {
      ...record(),
      source: "mobile",
      contactId: null,
      title: '<div class="ql-editor read-mode"><p><strong>Repair request</strong></p></div>',
      description: "<p>Replace <b>damaged</b> screen</p><script>alert(1)</script>",
      capturedName: "<b>New Customer</b>",
      capturedPhone: null
    },
    "mobile@example.com"
  );

  assert.equal(saved?.title, "Repair request");
  assert.equal(saved?.description, "Replace damaged screen");
  assert.equal(saved?.capturedName, "New Customer");
  assert.equal(saved?.contactId, 1);
});

test("non-mobile enquiries still require a customer or mobile number", async () => {
  let createCalls = 0;
  const repository = {
    create: async () => {
      createCalls += 1;
      return record();
    }
  } as unknown as EnquiryRepository;
  const service = new EnquiryService(repository, relations, {
    actorEmail: "web@example.com",
    actorUserId: 2,
    canViewAll: false
  });

  await assert.rejects(
    service.create(
      { ...record(), contactId: null, capturedName: null, capturedPhone: null },
      "web@example.com"
    ),
    /customer name or mobile number/i
  );
  assert.equal(createCalls, 0);
});

test("list scope and detail access use the server actor", async () => {
  let options: EnquiryListOptions | undefined;
  const repository = {
    listPage: async (input: EnquiryListOptions) => {
      options = input;
      return { items: [], total: 0, statusCounts: [] };
    },
    get: async () => record()
  } as unknown as EnquiryRepository;
  const viewer = { actorEmail: "other@example.com", actorUserId: 3, canViewAll: false };
  const service = new EnquiryService(repository, relations, viewer);

  await service.listPage({ scope: "assigned", page: 1, pageSize: 100, search: "", filter: "all" });
  assert.equal(options?.actorUserId, 3);
  assert.equal(options?.scope, "assigned");
  await assert.rejects(service.get(7), /cannot view this enquiry/i);
});

test("enquiry list marks rows with a pending closure request", async () => {
  const repository = {
    listPage: async () => ({ items: [record()], total: 1, statusCounts: [] })
  } as unknown as EnquiryRepository;
  const service = new EnquiryService(
    repository,
    relations,
    { actorEmail: "creator@example.com", actorUserId: 2, canViewAll: false },
    async (ids) => new Set(ids)
  );

  const page = await service.listPage({
    scope: "assigned",
    page: 1,
    pageSize: 100,
    search: "",
    filter: "all"
  });
  assert.equal(page.items[0]?.closurePending, true);
});

test("report uses the same server actor and all-enquiries scope", async () => {
  let options: EnquiryListOptions | undefined;
  const repository = {
    report: async (input: EnquiryListOptions) => {
      options = input;
      return [];
    }
  } as unknown as EnquiryRepository;
  const viewer = { actorEmail: "creator@example.com", actorUserId: 2, canViewAll: false };
  const service = new EnquiryService(repository, relations, viewer);
  await service.report({ fromAt: "2026-09-30T18:30:00.000Z", assignedUserId: "3" });
  assert.equal(options?.scope, "all");
  assert.equal(options?.actorEmail, viewer.actorEmail);
  assert.equal(options?.actorUserId, viewer.actorUserId);
  assert.equal(options?.canViewAll, false);
  assert.equal(options?.fromAt, "2026-09-30T18:30:00.000Z");
  assert.equal(options?.assignedUserId, "3");
});

test("completed status requires an outcome reason and re-open transition", async () => {
  let saved: EnquiryInput | undefined;
  let current = record();
  const repository = {
    get: async () => current,
    update: async (_id: number, input: EnquiryInput) => {
      saved = input;
      return { ...current, ...input } as EnquiryRecord;
    }
  } as unknown as EnquiryRepository;
  const service = new EnquiryService(repository, relations, {
    actorEmail: "creator@example.com",
    actorUserId: 2,
    canViewAll: false
  });

  await assert.rejects(
    service.updateProperties(7, { statusId: 3 }, "creator@example.com"),
    /outcome reason/i
  );
  await service.updateProperties(
    7,
    { statusId: 3, closedReason: "Customer accepted" },
    "creator@example.com"
  );
  assert.equal(saved?.closedReason, "Customer accepted");

  current = record(3);
  await assert.rejects(
    service.updateProperties(7, { statusId: 2 }, "creator@example.com"),
    /re-open/i
  );
  await service.updateProperties(7, { statusId: 4 }, "creator@example.com");
  assert.equal(saved?.closedReason, null);

  current = record(1);
  await assert.rejects(
    service.updateProperties(7, { statusId: 3, closedReason: "Done" }, "creator@example.com"),
    /open this new call/i
  );
});

test("closed status is applied only by closure approval", async () => {
  const current = record();
  const repository = {
    get: async () => current,
    update: async (_id: number, input: EnquiryInput) => ({ ...current, ...input })
  } as unknown as EnquiryRepository;
  const service = new EnquiryService(repository, relations, {
    actorEmail: "creator@example.com",
    actorUserId: 2,
    canViewAll: false
  });

  await assert.rejects(
    service.updateProperties(7, { statusId: 5, closedReason: "Finished" }, "creator@example.com"),
    /closure approval workflow/i
  );
});

test("Frappe imports preserve closed status while local updates still require approval", async () => {
  const current = { ...record(), source: "frappe", sourceReference: "ENQ7" };
  let saved: EnquiryInput | undefined;
  let sourceMetadataSaved = false;
  const repository = {
    get: async () => current,
    update: async (_id: number, input: EnquiryInput) => {
      saved = input;
      return { ...current, ...input, status: "closed" } as EnquiryRecord;
    },
    setImportedSourceMetadata: async () => {
      sourceMetadataSaved = true;
    }
  } as unknown as EnquiryRepository;
  const service = new EnquiryService(repository, relations, {
    actorEmail: "system:frappe-import",
    actorUserId: null,
    canViewAll: true
  });

  await service.updateImported(
    7,
    { ...record(5), source: "frappe", sourceReference: "ENQ7", closedReason: "Closed in Frappe" },
    "system:frappe-import",
    {
      createdAt: "2026-10-06T10:00:00.000Z",
      updatedAt: "2026-10-07T11:30:00.000Z",
      createdBy: "creator@example.com"
    }
  );

  assert.equal(saved?.statusId, 5);
  assert.equal(sourceMetadataSaved, true);
  await assert.rejects(
    service.updateProperties(7, { statusId: 5, closedReason: "Finished" }, "creator@example.com"),
    /closure approval workflow/i
  );
});

test("reverse sync preserves local enquiry identity, audit metadata, email and date precision", async () => {
  const current = {
    ...record(),
    capturedEmail: "local@example.test",
    sourceReference: "web-form",
    enquiredAt: "2026-10-07T09:45:00.000Z"
  };
  let saved: EnquiryInput | undefined;
  let metadataWrites = 0;
  const repository = {
    get: async () => current,
    update: async (_id: number, input: EnquiryInput) => {
      saved = input;
      return { ...current, ...input };
    },
    setImportedSourceMetadata: async () => {
      metadataWrites++;
    }
  } as unknown as EnquiryRepository;
  const service = new EnquiryService(repository, relations, {
    actorEmail: "system:frappe-import",
    actorUserId: null,
    canViewAll: true
  });
  const result = await service.updateImported(
    7,
    { ...record(), title: "Updated remotely", source: "frappe", sourceReference: "Q930" },
    "system:frappe-import",
    {
      createdAt: "2026-10-06T00:00:00.000Z",
      updatedAt: "2026-10-08T00:00:00.000Z",
      createdBy: "remote@example.test"
    }
  );
  assert.equal(saved?.title, "Updated remotely");
  assert.equal(saved?.source, current.source);
  assert.equal(saved?.sourceReference, current.sourceReference);
  assert.equal(saved?.capturedEmail, current.capturedEmail);
  assert.equal(saved?.enquiredAt, current.enquiredAt);
  assert.equal(result.createdBy, current.createdBy);
  assert.equal(result.createdAt, current.createdAt);
  assert.equal(metadataWrites, 0);
});

test("Frappe import keeps ambiguous contacts on the enquiry snapshot without linking arbitrarily", async () => {
  let createCount = 0;
  const repository = {
    create: async (
      input: EnquiryInput,
      _actor: string,
      resolveContact?: (transaction: never) => Promise<EnquiryInput>
    ) => {
      createCount += 1;
      if (resolveContact)
        await resolveContact({} as never).then(() => {
          throw new Error("Expected an ambiguous contact match.");
        });
      return { ...record(), ...input } as EnquiryRecord;
    }
  } as unknown as EnquiryRepository;
  const service = new EnquiryService(
    repository,
    {
      ...relations,
      resolveOrCreateCustomer: async () => {
        throw AppError.conflict("Ambiguous contact match.", {
          reason: "ambiguous-mobile-match"
        });
      }
    },
    { actorEmail: "system:frappe-import", actorUserId: null, canViewAll: true }
  );

  const result = await service.createImported(
    {
      ...record(),
      contactId: null,
      source: "frappe",
      sourceReference: "ENQ650",
      capturedPhone: "9994885548"
    },
    "system:frappe-import",
    {
      enquiryNo: 650,
      createdAt: "2026-10-06T10:00:00.000Z",
      updatedAt: "2026-10-07T11:30:00.000Z",
      createdBy: "creator@example.com"
    }
  );

  assert.equal(createCount, 2);
  assert.equal(result.contactId, null);
  assert.equal(result.capturedPhone, "9994885548");
});
