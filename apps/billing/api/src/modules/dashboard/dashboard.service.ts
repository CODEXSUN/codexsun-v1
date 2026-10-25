import { billingReportCurrency } from "../../auth/billing-scope.js";
import type { EventPublisher } from "@codexsun/framework/events";
import { createDashboardProjectionEvent } from "./dashboard.events.js";
import { DashboardRepository } from "./dashboard.repository.js";
import type { DashboardProjectionRequest } from "./dashboard.types.js";
import { DashboardProjectionWorker } from "./dashboard.worker.js";
import { BillingDatabaseEventPublisher } from "../runtime-persistence/runtime-persistence.repository.js";

export class DashboardService {
  constructor(
    private repositoryInstance?: DashboardRepository,
    private eventsInstance?: EventPublisher,
    private workerInstance?: DashboardProjectionWorker
  ) {}
  private get repository() {
    return (this.repositoryInstance ??= new DashboardRepository());
  }
  private get events() {
    return (this.eventsInstance ??= new BillingDatabaseEventPublisher());
  }
  private get worker() {
    return (this.workerInstance ??= new DashboardProjectionWorker(this.repository));
  }

  async get(databaseName: string, companyId?: number) {
    const context = await this.repository.context(databaseName, companyId);
    if (!context) return null;
    if (billingReportCurrency() !== "INR")
      return this.repository.rebuild(
        databaseName,
        context.company_id,
        context.financial_year_id,
        "billing.dashboard.currency-view",
        billingReportCurrency()
      );
    return (
      (await this.repository.get(databaseName, context.company_id, context.financial_year_id)) ??
      this.repository.rebuild(
        databaseName,
        context.company_id,
        context.financial_year_id,
        "billing.dashboard.self-heal"
      )
    );
  }

  async project(databaseName: string, request: DashboardProjectionRequest) {
    const event = createDashboardProjectionEvent(databaseName, request);
    await this.events.publish(event);
    return this.worker.process(databaseName, event);
  }

  async rebuildAll(databaseName: string, reason = "billing.dashboard.bootstrap") {
    const contexts = await this.repository.contexts(databaseName);
    for (const context of contexts) {
      await this.repository.rebuild(
        databaseName,
        Number(context.company_id),
        Number(context.financial_year_id),
        reason
      );
    }
    return contexts.length;
  }
}

export const billingDashboardProjection = new DashboardService();
