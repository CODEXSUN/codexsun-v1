/**
 * Billing Domain Types for CXMobile Client
 * Parity with M0 Billing Web workflows and contracts.
 */

// --- Status & Tax Types ---
export type BillingDocumentStatus = "draft" | "confirmed" | "posted" | "cancelled";
export type QuotationStatus = "draft" | "confirmed" | "cancelled";
export type SaleStatus = "draft" | "confirmed" | "cancelled";
export type PurchaseStatus = "draft" | "confirmed" | "cancelled";
export type ExportSaleStatus = "draft" | "confirmed" | "cancelled";
export type PaymentStatus = "draft" | "posted" | "cancelled";
export type ReceiptStatus = "draft" | "posted" | "cancelled";

export type TaxType = "cgst-sgst" | "igst";
export type PaymentMode = "cash" | "bank" | "upi" | "transfer";
export type ReceiptMode = "cash" | "bank" | "upi" | "transfer";

// --- Line Items ---
export interface BillingLineItemInput {
  colour?: string;
  colourId?: number | null;
  dcNo?: string;
  description: string;
  discountPercent?: number;
  discountAmount?: number;
  hsnCode?: string;
  hsnCodeId?: number | null;
  poNo?: string;
  productId?: number | null;
  productName?: string;
  quantity: number;
  rate: number;
  size?: string;
  sizeId?: number | null;
  taxId?: number | null;
  taxRate: number;
  unit?: string;
  unitId?: number;
}

export interface BillingLineItemCalculated extends BillingLineItemInput {
  id?: string;
  lineNumber: number;
  taxableAmount: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

// --- Quotations ---
export interface Quotation {
  amount: number;
  billingAddress?: string;
  billingAddressId?: number;
  companyId?: number;
  companyName?: string;
  createdAt?: string;
  currencyCode?: string;
  currencyId?: number;
  customerEmail?: string;
  customerGstin?: string;
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  date: string;
  financialYearId?: number;
  financialYearName?: string;
  generatedSalesInvoiceNo?: string;
  id: string;
  items: BillingLineItemCalculated[];
  ledgerId?: number | null;
  notes?: string;
  quotationNumber: string;
  roundOff?: number;
  shippingAddress?: string;
  shippingAddressId?: number;
  status: QuotationStatus;
  subtotal: number;
  taxAmount: number;
  taxType?: TaxType;
  terms?: string;
  updatedAt?: string;
  uuid?: string;
}

export interface QuotationSavePayload {
  amount?: number;
  billingAddress?: string;
  billingAddressId?: number;
  companyId?: number;
  currencyCode?: string;
  currencyId?: number;
  customerEmail?: string;
  customerGstin?: string;
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  date: string;
  financialYearId?: number;
  items: BillingLineItemInput[];
  notes?: string;
  quotationNumber?: string;
  roundOff?: number;
  shippingAddress?: string;
  shippingAddressId?: number;
  status?: QuotationStatus;
  taxType?: TaxType;
  terms?: string;
}

export interface QuotationConversionResult {
  quotation: Quotation;
  sale: {
    id?: string;
    invoiceNumber: string;
  };
}

export interface QuotationPdfResult {
  pdfUrl: string;
  shareableUrl?: string;
}

// --- Sales Invoices ---
export interface SalesInvoice {
  amount: number;
  allocatedAmount?: number;
  balanceDue?: number;
  billingAddress?: string;
  billingAddressId?: number;
  companyId?: number;
  companyName?: string;
  createdAt?: string;
  currencyCode?: string;
  currencyId?: number;
  customerEmail?: string;
  customerGstin?: string;
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  date?: string;
  financialYearId?: number;
  financialYearName?: string;
  id: string;
  invoiceNumber: string;
  issuedOn: string;
  items: BillingLineItemCalculated[];
  ledgerId?: number | null;
  notes?: string;
  quotationId?: string;
  roundOff?: number;
  shippingAddress?: string;
  shippingAddressId?: number;
  status: SaleStatus;
  subtotal: number;
  taxAmount: number;
  taxType: TaxType;
  terms?: string;
  updatedAt?: string;
  uuid?: string;
}

export interface SalesInvoiceSavePayload {
  amount?: number;
  billingAddress?: string;
  billingAddressId?: number;
  companyId?: number;
  currencyCode?: string;
  currencyId?: number;
  customerEmail?: string;
  customerGstin?: string;
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  financialYearId?: number;
  invoiceNumber?: string;
  issuedOn: string;
  items: BillingLineItemInput[];
  notes?: string;
  quotationId?: string;
  roundOff?: number;
  shippingAddress?: string;
  shippingAddressId?: number;
  status?: SaleStatus;
  taxType?: TaxType;
  terms?: string;
}

// --- Purchase Bills ---
export interface PurchaseBill {
  amount: number;
  allocatedAmount?: number;
  balanceDue?: number;
  billingAddress?: string;
  billingAddressId?: number;
  companyId?: number;
  companyName?: string;
  createdAt?: string;
  currencyCode?: string;
  currencyId?: number;
  date?: string;
  financialYearId?: number;
  financialYearName?: string;
  id: string;
  items: BillingLineItemCalculated[];
  ledgerId?: number | null;
  notes?: string;
  purchaseNumber: string;
  roundOff?: number;
  shippingAddress?: string;
  shippingAddressId?: number;
  status: PurchaseStatus;
  subtotal: number;
  supplierEmail?: string;
  supplierGstin?: string;
  supplierId?: number;
  supplierName: string;
  supplierPhone?: string;
  taxAmount: number;
  taxType: TaxType;
  terms?: string;
  updatedAt?: string;
  uuid?: string;
}

export interface PurchaseBillSavePayload {
  amount?: number;
  billingAddress?: string;
  billingAddressId?: number;
  companyId?: number;
  currencyCode?: string;
  currencyId?: number;
  date?: string;
  financialYearId?: number;
  items: BillingLineItemInput[];
  notes?: string;
  purchaseNumber?: string;
  roundOff?: number;
  shippingAddress?: string;
  shippingAddressId?: number;
  status?: PurchaseStatus;
  supplierEmail?: string;
  supplierGstin?: string;
  supplierId?: number;
  supplierName: string;
  supplierPhone?: string;
  taxType?: TaxType;
  terms?: string;
}

// --- Export Sales ---
export interface ExportSale {
  amount: number;
  amountInBaseCurrency?: number;
  billingAddress?: string;
  billingAddressId?: number;
  companyId?: number;
  companyName?: string;
  createdAt?: string;
  currencyCode: string;
  currencyId: number;
  customerEmail?: string;
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  exchangeRate?: number;
  financialYearId?: number;
  financialYearName?: string;
  foreignAmount?: number;
  id: string;
  invoiceNumber: string;
  issuedOn: string;
  items: BillingLineItemCalculated[];
  notes?: string;
  roundOff?: number;
  shippingAddress?: string;
  shippingAddressId?: number;
  status: ExportSaleStatus;
  subtotal: number;
  taxAmount: number;
  taxType: TaxType;
  terms?: string;
  updatedAt?: string;
  uuid?: string;
}

export interface ExportSaleSavePayload {
  amount?: number;
  billingAddress?: string;
  billingAddressId?: number;
  companyId?: number;
  currencyCode: string;
  currencyId: number;
  customerEmail?: string;
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  exchangeRate?: number;
  financialYearId?: number;
  invoiceNumber?: string;
  issuedOn: string;
  items: BillingLineItemInput[];
  notes?: string;
  roundOff?: number;
  shippingAddress?: string;
  shippingAddressId?: number;
  status?: ExportSaleStatus;
  taxType?: TaxType;
  terms?: string;
}

// --- Payments ---
export interface PaymentAllocationInput {
  allocatedAmount: number;
  purchaseId: string;
}

export interface PaymentAllocation extends PaymentAllocationInput {
  documentDate?: string;
  documentNo?: string;
  documentTotal?: number;
  id?: string;
  previousBalance?: number;
}

export interface Payment {
  allocatedAmount: number;
  allocations: PaymentAllocation[];
  amount: number;
  companyId?: number;
  companyName?: string;
  createdAt?: string;
  currencyCode?: string;
  currencyId?: number;
  discountAmount?: number;
  financialYearId?: number;
  financialYearName?: string;
  id: string;
  ledgerId?: number;
  ledgerName?: string;
  notes?: string;
  paymentDate: string;
  paymentMode: PaymentMode;
  paymentNumber: string;
  referenceDate?: string;
  referenceNo?: string;
  roundOff?: number;
  status: PaymentStatus;
  supplierId: number;
  supplierName: string;
  tdsAmount?: number;
  totalAmount?: number;
  unallocatedAmount: number;
  updatedAt?: string;
  uuid?: string;
}

export interface PaymentSavePayload {
  allocations?: PaymentAllocationInput[];
  amount: number;
  companyId?: number;
  currencyId?: number;
  discountAmount?: number;
  financialYearId?: number;
  ledgerId?: number;
  notes?: string;
  paymentDate: string;
  paymentMode: PaymentMode;
  paymentNumber?: string;
  referenceDate?: string;
  referenceNo?: string;
  roundOff?: number;
  supplierId: number;
  supplierName?: string;
  tdsAmount?: number;
}

// --- Receipts ---
export interface ReceiptAllocationInput {
  allocatedAmount: number;
  documentKind?: "sale" | "export-sale";
  saleId: string;
}

export interface ReceiptAllocation extends ReceiptAllocationInput {
  documentDate?: string;
  documentNo?: string;
  documentTotal?: number;
  id?: string;
  previousBalance?: number;
}

export interface Receipt {
  allocatedAmount: number;
  allocations: ReceiptAllocation[];
  amount: number;
  companyId?: number;
  companyName?: string;
  createdAt?: string;
  currencyCode?: string;
  currencyId?: number;
  customerId: number;
  customerName: string;
  discountAmount?: number;
  financialYearId?: number;
  financialYearName?: string;
  id: string;
  ledgerId?: number;
  ledgerName?: string;
  notes?: string;
  receiptDate: string;
  receiptMode: ReceiptMode;
  receiptNumber: string;
  referenceDate?: string;
  referenceNo?: string;
  roundOff?: number;
  status: ReceiptStatus;
  tdsAmount?: number;
  totalAmount?: number;
  unallocatedAmount: number;
  updatedAt?: string;
  uuid?: string;
}

export interface ReceiptSavePayload {
  allocations?: ReceiptAllocationInput[];
  amount: number;
  companyId?: number;
  currencyId?: number;
  customerId: number;
  customerName?: string;
  discountAmount?: number;
  financialYearId?: number;
  ledgerId?: number;
  notes?: string;
  receiptDate: string;
  receiptMode: ReceiptMode;
  receiptNumber?: string;
  referenceDate?: string;
  referenceNo?: string;
  roundOff?: number;
  tdsAmount?: number;
}

// --- Allocation Candidates ---
export interface OpenInvoiceCandidate {
  currencyId?: number;
  customerId: number;
  documentDate: string;
  documentNo: string;
  documentTotal: number;
  outstandingAmount: number;
  saleId: string;
}

export interface OpenBillCandidate {
  currencyId?: number;
  documentDate: string;
  documentNo: string;
  documentTotal: number;
  outstandingAmount: number;
  purchaseId: string;
  supplierId: number;
}

// --- Reports ---
export interface ReportFilterBase {
  contactId?: number | string;
  from?: string;
  page?: number;
  pageSize?: number;
  to?: string;
}

export interface StatementItem {
  balance: number;
  credit: number;
  date: string;
  debit: number;
  description: string;
  documentId?: string;
  documentKind?: string;
  id: string;
  voucherNo: string;
}

export interface StatementAging {
  bucket0To30: number;
  bucket31To60: number;
  bucket61To90: number;
  bucket90Plus: number;
  current: number;
  total: number;
  undatedOpening?: number;
}

export interface CustomerStatementReport {
  ageing?: StatementAging;
  closingBalance: number;
  contactId?: number;
  contactName?: string;
  items: StatementItem[];
  openingBalance: number;
  page: number;
  pageSize: number;
  total: number;
  totalCredit: number;
  totalDebit: number;
}

export interface CustomerSummaryItem {
  balance: number;
  code?: string;
  contactId: number;
  contactName: string;
  credit: number;
  current: number;
  debit: number;
  overdue: number;
}

export interface CustomerSummaryReport {
  items: CustomerSummaryItem[];
  totalBalance: number;
  totalCredit: number;
  totalDebit: number;
}

export interface SupplierStatementReport {
  ageing?: StatementAging;
  closingBalance: number;
  contactId?: number;
  contactName?: string;
  items: StatementItem[];
  openingBalance: number;
  page: number;
  pageSize: number;
  total: number;
  totalCredit: number;
  totalDebit: number;
}

export interface SupplierSummaryItem {
  balance: number;
  code?: string;
  contactId: number;
  contactName: string;
  credit: number;
  current: number;
  debit: number;
  overdue: number;
}

export interface SupplierSummaryReport {
  items: SupplierSummaryItem[];
  totalBalance: number;
  totalCredit: number;
  totalDebit: number;
}

export interface StockStatementItem {
  closingQuantity: number;
  inwardQuantity: number;
  openingQuantity: number;
  outwardQuantity: number;
  productId: number;
  productName: string;
  rate: number;
  unit: string;
  valuation: number;
}

export interface StockStatementReport {
  items: StockStatementItem[];
  page: number;
  pageSize: number;
  total: number;
  totalValuation: number;
}

export interface GstStatementSummary {
  cgstAmount: number;
  filingStatus?: "filed" | "pending" | "ready";
  igstAmount: number;
  month: number;
  purchaseCount: number;
  purchaseTaxable: number;
  salesCount: number;
  salesTaxable: number;
  sgstAmount: number;
  totalTax: number;
  year: number;
}

export interface GstFilingPayload {
  acknowledgementNumber?: string;
  filedAt: string;
  month: number;
  status: "filed" | "pending" | "ready";
  year: number;
}

// --- Settings & Document Settings ---
export interface DocumentNumberSettings {
  automatic: boolean;
  nextNumber: number;
  padding: number;
  prefix: string;
  separator: string;
  suffix: string;
  usePrefix: boolean;
  useSeparator: boolean;
  useSuffix: boolean;
}

export interface BillingSettings {
  customise?: {
    documentTitles?: Record<string, string>;
    printLanguage?: string;
  };
  features?: {
    exportSales?: boolean;
    quotation?: boolean;
    tconnect?: boolean;
  };
  gstApiMode?: "none" | "einvoice_eway" | "einvoice_only" | "eway_only";
  numbering: {
    exportSales: DocumentNumberSettings;
    payment: DocumentNumberSettings;
    purchase: DocumentNumberSettings;
    quotation: DocumentNumberSettings;
    receipt: DocumentNumberSettings;
    sales: DocumentNumberSettings;
  };
  printing?: {
    customTerms?: string;
    defaultTerms?: string;
    useCustomTerms?: boolean;
  };
}

// --- Opening Balance ---
export type OpeningBalanceRole = "customer" | "supplier";
export type OpeningBalanceClassification = "debit" | "credit";

export interface OpeningBalanceInput {
  amount: number;
  assignLegacy?: boolean;
  contactId: number;
  currencyId: number;
  partyRole: OpeningBalanceRole;
  reason: string;
}

export interface OpeningBalance extends OpeningBalanceInput {
  classification: OpeningBalanceClassification;
  companyId?: number;
  contactName?: string;
  currencyCode?: string;
  financialYearId?: number;
  id: string;
}

// --- Dashboard ---
export interface DashboardMetric {
  count: number;
  financialYear?: number;
  month?: number;
  total: number;
}

export interface DashboardOutstanding {
  contactId: number;
  contactName: string;
  creditLimit?: number;
  direction: "payable" | "receivable";
  grossAmount: number;
  outstandingAmount: number;
  overLimit?: boolean;
  settledAmount?: number;
}

export interface DashboardRecentItem {
  amount: number;
  contactName: string;
  date: string;
  documentId: string;
  documentNumber: string;
  kind: "quotation" | "sales" | "purchase" | "payment" | "receipt" | "export-sales";
  status: string;
}

export interface BillingDashboardData {
  companyId?: number;
  companyName?: string;
  currencyCode?: string;
  financialYearEnd?: string;
  financialYearId?: number;
  financialYearName?: string;
  financialYearStart?: string;
  metrics: {
    payment: DashboardMetric;
    purchase: DashboardMetric;
    receipt: DashboardMetric;
    sales: DashboardMetric;
  };
  monthly?: Array<{
    label: string;
    month: string;
    payment: number;
    purchase: number;
    receipt: number;
    sales: number;
  }>;
  outstanding: DashboardOutstanding[];
  recent: DashboardRecentItem[];
}
