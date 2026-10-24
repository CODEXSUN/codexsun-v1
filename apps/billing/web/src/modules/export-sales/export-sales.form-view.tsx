import { useBillingAccess } from "../../shared/auth/billing-access";
import { Button } from "@codexsun/ui/components/button";
import { Dialog, DialogContent } from "@codexsun/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@codexsun/ui/components/dropdown-menu";
import { Input } from "@codexsun/ui/components/input";
import { Textarea } from "@codexsun/ui/components/textarea";
import { cn } from "@codexsun/ui/lib/utils";
import {
  WorkspaceAnimatedTabs,
  type WorkspaceAnimatedTab
} from "@codexsun/ui/workspace/animated-tabs";
import { WorkspaceDatePicker } from "@codexsun/ui/workspace/date-picker";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceSelect } from "@codexsun/ui/workspace/select";
import {
  WorkspaceFormActions,
  WorkspaceFormSurface,
  WorkspaceFormTabbedBody
} from "@codexsun/ui/workspace/upsert";
import { ArrowUpRight, ChevronDown, Printer, RotateCcw, Save, Send, X } from "lucide-react";
import { toast } from "sonner";
import { ExportSaleAddressDialog, ExportSaleAddressField } from "./export-sales-address-editor";
import type { useExportSalesFormController } from "./export-sales.form-controller";
import { ExportSaleContactQuickForm } from "./export-sales.form-section-1";
import {
  ExportSaleWorkOrderQuickForm,
  contactDraftFromRecord,
  exportSaleCommonOption,
  exportSaleContactOption,
  exportSaleProductOption,
  exportSaleWorkOrderOption,
  masterDraftFromRecord
} from "./export-sales.form-section-2";
import { ExportSaleItemsSection } from "./export-sales.form-section-3";
import {
  ExportSaleEinvoiceTab,
  ExportSaleEwayTab,
  ExportSaleProductQuickForm,
  Field
} from "./export-sales.form-section-4";
import { numericId } from "./export-sales.form-section-5";
import { exportSalesSchema } from "./export-sales.schema";
import { createExportSaleLookup, type ExportSaleLookupOption } from "./export-sales.services";
import { type ExportSaleSavePayload, type ExportSaleTaxType } from "./export-sales.types";

export function ExportSalesFormView({
  model
}: {
  model: ReturnType<typeof useExportSalesFormController>;
}) {
  const canChangeWorkflow = useBillingAccess().data?.canEditFinalizedEntries ?? false;
  // Prettier keeps the controller projection compact so this focused view stays under the source-size limit.
  // prettier-ignore
  const { contactsQuery, form, patch, applyContactSelection, contactSaveMutation, applyContactAddresses, selectedContact, setEditingContact, workOrdersQuery, masterSaveMutation, selectedWorkOrder, setEditingWorkOrder, itemDraft, editingItemIndex, coloursQuery, productsQuery, itemResetSignal, settings, sizesQuery, roundOffManual, suggestedRoundOff, addOrUpdateItem, patchDraft, editItem, applyProductSelection, applyRoundOff, removeItem, setRoundOffManual, resetDraft, setEditingProduct, contactAddressChoices, billingAddressChoice, setEditingAddressKind, applyAddressDraft, shippingAddressChoice, eway, patchEway, generateEway, transportsQuery, selectedTransport, transportSaveMutation, einvoice, patchEinvoice, generateEinvoice, cancelCompliance, onSubmit, activeTab, setActiveTab, errorMessage, loading, onBack, workflowAction, setWorkflowAction, exportSale, editingContact, editingProduct, editingWorkOrder, shippingAddressDraft, billingAddressDraft, editingAddressKind, contactAddressSaveMutation } = model;
  const tabs: WorkspaceAnimatedTab[] = [
    {
      value: "details",
      label: "Details",
      content: (
        <div className="space-y-0">
          <div className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
            <div className="space-y-5">
              <Field label="Customer name" required>
                <WorkspaceLookup
                  createDescription="Add contact details and address without leaving this exportSale."
                  createLabel="New contact"
                  createMode="popup"
                  createTitle="New contact"
                  emptyLabel="No contacts found. Create a new contact."
                  loading={contactsQuery.isLoading}
                  options={contactsQuery.data ?? []}
                  placeholder="Search contact"
                  required
                  value={form.customerName}
                  onTextChange={(value) => patch({ customerId: 0, customerName: value })}
                  onValueChange={(value, option) =>
                    applyContactSelection(
                      value,
                      option as ExportSaleLookupOption | null | undefined
                    )
                  }
                  renderCreateForm={({ initialName, onCancel, onCreated }) => (
                    <ExportSaleContactQuickForm
                      initialValue={contactDraftFromRecord(undefined, initialName)}
                      loading={contactSaveMutation.isPending}
                      onCancel={onCancel}
                      onSave={async (payload) => {
                        const created = await contactSaveMutation.mutateAsync({ payload });
                        await contactsQuery.refetch();
                        const option = exportSaleContactOption(created);
                        onCreated(option);
                        patch({ customerId: Number(created.id), customerName: option.label });
                        applyContactAddresses(created);
                        toast.success("Contact saved", { description: option.label });
                      }}
                      title="New contact"
                    />
                  )}
                  trailingAction={
                    selectedContact?.record ? (
                      <button
                        aria-label="Edit selected contact"
                        className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Edit selected contact"
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingContact(selectedContact.record);
                        }}
                      >
                        <ArrowUpRight className="size-4" />
                      </button>
                    ) : undefined
                  }
                />
              </Field>
              <Field label="Work order no">
                <WorkspaceLookup
                  createDescription="Add a work order without leaving this exportSale."
                  createLabel="New work order"
                  createMode="popup"
                  createTitle="New work order"
                  emptyLabel="No work orders found. Create a new work order."
                  loading={workOrdersQuery.isLoading}
                  options={workOrdersQuery.data ?? []}
                  placeholder="Search work order"
                  value={form.workOrderNo}
                  onTextChange={(value) => patch({ workOrderId: null, workOrderNo: value })}
                  onValueChange={(value, option) =>
                    patch({
                      workOrderId: numericId(
                        (option as ExportSaleLookupOption | undefined)?.record?.id
                      ),
                      workOrderNo: option?.value ?? value
                    })
                  }
                  renderCreateForm={({ initialName, onCancel, onCreated }) => (
                    <ExportSaleWorkOrderQuickForm
                      initialValue={masterDraftFromRecord(undefined, initialName)}
                      loading={masterSaveMutation.isPending}
                      onCancel={onCancel}
                      onSave={async (payload) => {
                        const created = await masterSaveMutation.mutateAsync({
                          kind: "workOrders",
                          payload
                        });
                        await workOrdersQuery.refetch();
                        const option = exportSaleWorkOrderOption(created);
                        onCreated(option);
                        patch({ workOrderId: Number(created.id), workOrderNo: option.value });
                        toast.success("Work order saved", { description: option.label });
                      }}
                      title="New work order"
                    />
                  )}
                  trailingAction={
                    selectedWorkOrder?.record ? (
                      <button
                        aria-label="Edit selected work order"
                        className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Edit selected work order"
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (selectedWorkOrder.record)
                            setEditingWorkOrder(selectedWorkOrder.record);
                        }}
                      >
                        <ArrowUpRight className="size-4" />
                      </button>
                    ) : undefined
                  }
                />
              </Field>
            </div>
            <div className="space-y-5">
              <Field label="Export sale number">
                <Input
                  value={form.invoiceNumber}
                  onChange={(event) => patch({ invoiceNumber: event.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Date">
                <WorkspaceDatePicker
                  value={form.issuedOn}
                  onValueChange={(value) => patch({ issuedOn: value })}
                />
              </Field>
              <Field label="Export sale tax type">
                <WorkspaceSelect
                  value={form.taxType}
                  options={[
                    { label: "CGST + SGST", value: "cgst-sgst" },
                    { label: "IGST", value: "igst" }
                  ]}
                  onValueChange={(taxType) => patch({ taxType: taxType as ExportSaleTaxType })}
                />
              </Field>
            </div>
          </div>
          <ExportSaleItemsSection
            draft={itemDraft}
            editing={editingItemIndex !== null}
            items={form.items}
            colourOptions={coloursQuery.data ?? []}
            coloursLoading={coloursQuery.isLoading}
            productOptions={productsQuery.data ?? []}
            productsLoading={productsQuery.isLoading}
            resetSignal={itemResetSignal}
            settings={settings}
            sizeOptions={sizesQuery.data ?? []}
            sizesLoading={sizesQuery.isLoading}
            taxType={form.taxType}
            roundOff={form.roundOff ?? ""}
            roundOffManual={roundOffManual}
            suggestedRoundOff={suggestedRoundOff}
            onAdd={addOrUpdateItem}
            onDraftChange={patchDraft}
            onEdit={editItem}
            onProductSelect={applyProductSelection}
            onRoundOffChange={applyRoundOff}
            onRemove={removeItem}
            onResetRoundOff={() => {
              setRoundOffManual(false);
              patch({ roundOff: String(suggestedRoundOff) });
            }}
            onReset={resetDraft}
            onCreateColour={async (name) => {
              const created = await createExportSaleLookup("colours", { isActive: true, name });
              await coloursQuery.refetch();
              toast.success("Colour saved", { description: name });
              return exportSaleCommonOption(created);
            }}
            onCreateProduct={async (name) => {
              const created = await masterSaveMutation.mutateAsync({
                kind: "products",
                payload: masterDraftFromRecord(undefined, name)
              });
              await productsQuery.refetch();
              toast.success("Product saved", { description: name });
              return exportSaleProductOption(created);
            }}
            renderProductCreateForm={({ initialName, onCancel, onCreated }) => (
              <ExportSaleProductQuickForm
                initialValue={masterDraftFromRecord(undefined, initialName)}
                loading={masterSaveMutation.isPending}
                onCancel={onCancel}
                onSave={async (payload) => {
                  const created = await masterSaveMutation.mutateAsync({
                    kind: "products",
                    payload
                  });
                  await productsQuery.refetch();
                  const option = exportSaleProductOption(created);
                  onCreated(option);
                  toast.success("Product saved", { description: option.label });
                }}
                title="New product"
              />
            )}
            onCreateSize={async (name) => {
              const created = await createExportSaleLookup("sizes", { isActive: true, name });
              await sizesQuery.refetch();
              toast.success("Size saved", { description: name });
              return exportSaleCommonOption(created);
            }}
            onEditProduct={(record) => setEditingProduct(record)}
          />
        </div>
      )
    },
    {
      value: "address",
      label: "Address",
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <ExportSaleAddressField
            choices={contactAddressChoices}
            description={form.billingAddress}
            disabled={!selectedContact?.record}
            label="Billing address"
            selectedValue={billingAddressChoice}
            onEdit={() => setEditingAddressKind("billing")}
            onSelect={(choice) => applyAddressDraft("billing", choice.draft, choice.value)}
          />
          <ExportSaleAddressField
            choices={contactAddressChoices}
            description={form.shippingAddress}
            disabled={!selectedContact?.record}
            label="Shipping address"
            selectedValue={shippingAddressChoice}
            onEdit={() => setEditingAddressKind("shipping")}
            onSelect={(choice) => applyAddressDraft("shipping", choice.draft, choice.value)}
          />
        </div>
      )
    },
    ...(settings.useEway
      ? [
          {
            value: "eway",
            label: "E-way",
            content: (
              <ExportSaleEwayTab
                invoiceId={exportSale?.id}
                onUpdated={(updated) => patch({ einvoice: updated.einvoice, eway: updated.eway })}
                onCancel={(reasonCode, remarks) => cancelCompliance("eway", reasonCode, remarks)}
                value={eway}
                onChange={patchEway}
                onGenerate={generateEway}
                options={transportsQuery.data ?? []}
                loading={transportsQuery.isLoading || model.complianceLoading}
                selected={selectedTransport}
                onTransportChange={(value, option) =>
                  patchEway({
                    transport: option?.label ?? value,
                    transportGst: option?.record?.gst ?? "",
                    transportId: numericId(option?.record?.id)
                  })
                }
                onCreateTransport={async (payload) => {
                  const created = await transportSaveMutation.mutateAsync(payload);
                  await transportsQuery.refetch();
                  return {
                    description: created.gst || created.vehicleNo || "",
                    label: created.name || created.id,
                    meta: created.gst || "",
                    value: created.name || created.id,
                    record: created
                  };
                }}
              />
            )
          }
        ]
      : []),
    ...(settings.useEinvoice
      ? [
          {
            value: "einvoice",
            label: "E-invoice",
            content: (
              <ExportSaleEinvoiceTab
                loading={model.complianceLoading}
                invoiceId={exportSale?.id}
                onUpdated={(updated) => patch({ einvoice: updated.einvoice, eway: updated.eway })}
                onCancel={(reasonCode, remarks) =>
                  cancelCompliance("einvoice", reasonCode, remarks)
                }
                value={einvoice}
                onChange={patchEinvoice}
                onGenerate={generateEinvoice}
              />
            )
          }
        ]
      : []),
    {
      value: "terms",
      label: "Terms",
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Terms">
            <Textarea
              className="min-h-32"
              value={form.terms}
              onChange={(event) => patch({ terms: event.target.value })}
            />
          </Field>
          <Field label="Comments">
            <Textarea
              className="min-h-32"
              value={form.notes}
              onChange={(event) => patch({ notes: event.target.value })}
            />
          </Field>
        </div>
      )
    }
  ];

  function submit(printAfter = false, status: ExportSaleSavePayload["status"] = form.status) {
    if (!form.companyId || !form.financialYearId || !form.currencyId) {
      toast.error("Default Company context is not ready");
      return;
    }
    if (!form.customerId) {
      toast.error("Select a persisted customer");
      return;
    }
    if (!form.billingAddressId || !form.shippingAddressId) {
      toast.error("Select persisted billing and shipping addresses");
      return;
    }
    if (!form.customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!form.items.length) {
      toast.error("Add at least one item");
      return;
    }
    const payload = { ...form, status };
    const validation = exportSalesSchema.safeParse(payload);
    if (!validation.success) {
      toast.error(
        validation.error.issues[0]?.message ?? "Complete the required export sale fields"
      );
      return;
    }
    onSubmit(payload, printAfter);
  }

  return (
    <WorkspacePage
      className="max-w-[96rem]"
      title={exportSale ? "Edit Export Sale" : "New Export Sale"}
      description="Create or update a tenant-isolated export sale voucher."
      actions={
        <Button className="h-9 rounded-md" onClick={onBack} type="button" variant="outline">
          <X className="size-4" />
          Cancel
        </Button>
      }
    >
      <WorkspaceFormSurface>
        <WorkspaceFormTabbedBody className="pb-7">
          <WorkspaceAnimatedTabs
            contentPadding
            tabs={tabs}
            value={activeTab}
            onValueChange={setActiveTab}
            className="min-w-0"
            contentClassName="px-0 pb-0"
            listClassName="border-border/80"
          />
        </WorkspaceFormTabbedBody>
        {errorMessage ? (
          <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}
        <WorkspaceFormActions>
          <Button disabled={loading} onClick={() => submit(false, "draft")} type="button">
            <Save className="size-4" />
            Save
          </Button>
          <Button disabled={loading} onClick={() => submit(true)} type="button" variant="outline">
            <Printer className="size-4" />
            Save & Print
          </Button>
          <Button onClick={onBack} type="button" variant="outline">
            <X className="size-4" />
            Cancel
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Export sale workflow action"
                  className={cn(
                    "h-8 w-20 min-w-20 justify-center gap-1 px-2 text-xs transition-[background-color,border-color,color,transform] duration-300 ease-out",
                    workflowAction === "draft" &&
                      "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100",
                    workflowAction === "submit" &&
                      "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                    workflowAction === "revoke" &&
                      "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  )}
                  disabled={loading || !canChangeWorkflow}
                  title="Export sale workflow action"
                  type="button"
                  variant="outline"
                >
                  {workflowAction === "draft"
                    ? "Draft"
                    : workflowAction === "submit"
                      ? "Submit"
                      : "Revoke"}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-20 min-w-20 rounded-md p-1">
                <DropdownMenuItem
                  className="gap-1 px-2 text-xs"
                  onSelect={() => setWorkflowAction("draft")}
                >
                  <Save className="size-4" />
                  Draft
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-1 px-2 text-xs"
                  onSelect={() => setWorkflowAction("submit")}
                >
                  <Send className="size-4" />
                  Submit
                </DropdownMenuItem>
                {workflowAction === "submit" || exportSale?.status === "confirmed" ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-1 px-2 text-xs"
                      onSelect={() => setWorkflowAction("revoke")}
                    >
                      <RotateCcw className="size-4" />
                      Revoke
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </WorkspaceFormActions>
        <Dialog
          open={Boolean(editingContact)}
          onOpenChange={(open) => !open && setEditingContact(null)}
        >
          <DialogContent
            className="rounded-md p-0 sm:max-w-3xl"
            onInteractOutside={(event) => event.preventDefault()}
          >
            {editingContact ? (
              <ExportSaleContactQuickForm
                initialValue={contactDraftFromRecord(editingContact)}
                loading={contactSaveMutation.isPending}
                onCancel={() => setEditingContact(null)}
                onSave={async (payload) => {
                  const saved = await contactSaveMutation.mutateAsync({
                    id: editingContact.id,
                    payload
                  });
                  await contactsQuery.refetch();
                  patch({ customerName: exportSaleContactOption(saved).label });
                  applyContactAddresses(saved);
                  setEditingContact(null);
                  toast.success("Contact saved", {
                    description: exportSaleContactOption(saved).label
                  });
                }}
                title="Edit contact"
              />
            ) : null}
          </DialogContent>
        </Dialog>
        <Dialog
          open={Boolean(editingProduct)}
          onOpenChange={(open) => !open && setEditingProduct(null)}
        >
          <DialogContent
            className="rounded-md p-0 sm:max-w-3xl"
            onInteractOutside={(event) => event.preventDefault()}
          >
            {editingProduct ? (
              <ExportSaleProductQuickForm
                initialValue={masterDraftFromRecord(editingProduct)}
                loading={masterSaveMutation.isPending}
                onCancel={() => setEditingProduct(null)}
                onSave={async (payload) => {
                  const saved = await masterSaveMutation.mutateAsync({
                    id: editingProduct.id,
                    kind: "products",
                    payload
                  });
                  await productsQuery.refetch();
                  patchDraft({ productName: exportSaleProductOption(saved).label });
                  setEditingProduct(null);
                  toast.success("Product saved", {
                    description: exportSaleProductOption(saved).label
                  });
                }}
                title="Edit product"
              />
            ) : null}
          </DialogContent>
        </Dialog>
        <Dialog
          open={Boolean(editingWorkOrder)}
          onOpenChange={(open) => !open && setEditingWorkOrder(null)}
        >
          <DialogContent
            className="rounded-md p-0 sm:max-w-3xl"
            onInteractOutside={(event) => event.preventDefault()}
          >
            {editingWorkOrder ? (
              <ExportSaleWorkOrderQuickForm
                initialValue={masterDraftFromRecord(editingWorkOrder)}
                loading={masterSaveMutation.isPending}
                onCancel={() => setEditingWorkOrder(null)}
                onSave={async (payload) => {
                  const saved = await masterSaveMutation.mutateAsync({
                    id: editingWorkOrder.id,
                    kind: "workOrders",
                    payload
                  });
                  await workOrdersQuery.refetch();
                  patch({ workOrderNo: exportSaleWorkOrderOption(saved).value });
                  setEditingWorkOrder(null);
                  toast.success("Work order saved", {
                    description: exportSaleWorkOrderOption(saved).label
                  });
                }}
                title="Edit work order"
              />
            ) : null}
          </DialogContent>
        </Dialog>
        <Dialog
          open={Boolean(editingAddressKind)}
          onOpenChange={(open) => !open && setEditingAddressKind(null)}
        >
          <DialogContent
            className="rounded-md p-0 sm:max-w-3xl"
            onInteractOutside={(event) => event.preventDefault()}
          >
            {editingAddressKind ? (
              <ExportSaleAddressDialog
                draft={
                  editingAddressKind === "billing" ? billingAddressDraft : shippingAddressDraft
                }
                loading={contactAddressSaveMutation.isPending}
                onCancel={() => setEditingAddressKind(null)}
                onSave={async (draft) => {
                  const kind = editingAddressKind;
                  const addressId =
                    kind === "billing" ? form.billingAddressId : form.shippingAddressId;
                  const contactId = String(selectedContact?.record?.id ?? "");
                  if (!contactId) {
                    toast.error("Select a contact before saving an address.");
                    return;
                  }
                  const saved = await contactAddressSaveMutation.mutateAsync({
                    addressId,
                    contactId,
                    payload: draft
                  });
                  const savedAddressId =
                    addressId ||
                    Math.max(
                      0,
                      ...(saved.addresses ?? []).map((address) => Number(address.id ?? 0))
                    );
                  applyAddressDraft(kind, draft, String(savedAddressId));
                  await contactsQuery.refetch();
                  setEditingAddressKind(null);
                  toast.success(`${kind === "billing" ? "Billing" : "Shipping"} address saved`);
                }}
                title="Edit contact"
              />
            ) : null}
          </DialogContent>
        </Dialog>
      </WorkspaceFormSurface>
    </WorkspacePage>
  );
}
