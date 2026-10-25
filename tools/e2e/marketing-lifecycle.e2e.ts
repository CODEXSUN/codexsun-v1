import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { sql } from "kysely";
import type { MarketingContext } from "../../apps/marketing/api/src/index.js";
import { recordMailSuppression } from "../../apps/mail/api/src/index.js";

/**
 * Conduct independent verification of the full Marketing lifecycle:
 * - Marketing Lead: create, update, assign, activity, revision collision (stale revision yields 409), invalid transition rejection (qualified -> new).
 * - Marketing Qualification: decisions (qualified, disqualified, deferred), criteria, reason. Verify that only a qualified lead can convert; converting disqualified or deferred lead is rejected.
 * - Marketing Sales Conversion: create conversion from qualified lead, declaredValue, currency, cancellation/reversal with reason. Concurrent/duplicate conversion on same lead is idempotent or rejected.
 * - Marketing Outcome: terminal disposition (won, lost, nurture, unresponsive, withdrawn), deliberate reopen/correction with reference to previous outcome.
 * - Marketing Follow-up: create action/reminder (call, email, meeting, review) with due date, mark complete, activity.
 * - Contact restrictions: Marketing-owned restrictions (restricted, released) checked fail-closed; verify Mail suppression blocks independently.
 * - Multi-tenant isolation: database, company, brand swaps yield 403/404 denial with zero foreign data disclosure.
 */
export async function verifyMarketingLifecycle(
  app: FastifyInstance,
  context: () => Promise<MarketingContext>,
  databaseNames: string[],
  select: (tenant: number, company?: number, actor?: string) => void
) {
  select(0);
  const ctx = await context();

  // 1. Ensure Brand exists for Tenant 0
  const brandRes = await app.inject({
    method: "POST",
    url: "/marketing/brands",
    payload: {
      name: "Lifecycle Test Brand",
      timezone: "Asia/Kolkata",
      website: "https://lifecycle.test",
      status: "active"
    }
  });
  assert.equal(brandRes.statusCode, 200, brandRes.body);
  const brand = brandRes.json().data;
  assert.ok(brand.uuid);

  const create = async (url: string, payload: unknown) => {
    const res = await app.inject({ method: "POST", url, payload });
    assert.equal(res.statusCode, 200, `POST ${url} failed: ${res.body}`);
    return res.json().data;
  };

  // =========================================================================
  // 2. Marketing Lead: create, update, assign, activity, revision collision, invalid transitions
  // =========================================================================
  const leadPayload = {
    brandUuid: brand.uuid,
    name: "Alex Johnson",
    email: "alex@example.test",
    phone: "+919876543210",
    companyName: "Johnson Tech",
    source: "website",
    notes: "Prospective enterprise client",
    status: "new" as const
  };

  const lead = await create("/marketing/leads", leadPayload);
  assert.ok(lead.uuid);
  assert.equal(lead.name, "Alex Johnson");
  assert.equal(lead.status, "new");
  assert.equal(lead.revision, 1);
  assert.equal(lead.companyId, 1);
  assert.equal(lead.brandUuid, brand.uuid);

  // Update lead
  const updateRes = await app.inject({
    method: "PUT",
    url: `/marketing/leads/${lead.uuid}`,
    payload: {
      ...leadPayload,
      notes: "Contacted via direct telephone call",
      status: "contacted",
      expectedRevision: lead.revision
    }
  });
  assert.equal(updateRes.statusCode, 200, updateRes.body);
  const updatedLead = updateRes.json().data;
  assert.equal(updatedLead.notes, "Contacted via direct telephone call");
  assert.equal(updatedLead.status, "contacted");
  assert.equal(updatedLead.revision, 2);

  // Assign lead
  const assignRes = await app.inject({
    method: "POST",
    url: `/marketing/leads/${lead.uuid}/assign`,
    payload: {
      assignedTo: "senior.rep@example.test",
      expectedRevision: updatedLead.revision
    }
  });
  assert.equal(assignRes.statusCode, 200, assignRes.body);
  const assignedLead = assignRes.json().data;
  assert.equal(assignedLead.assignedTo, "senior.rep@example.test");
  assert.equal(assignedLead.revision, 3);

  // Revision collision: stale revision yields 409
  const staleCollision = await app.inject({
    method: "PUT",
    url: `/marketing/leads/${lead.uuid}`,
    payload: {
      ...leadPayload,
      status: "contacted",
      notes: "Stale edit attempt",
      expectedRevision: 1
    }
  });
  assert.equal(staleCollision.statusCode, 409, "Stale revision must yield 409 Conflict");

  const staleAssign = await app.inject({
    method: "POST",
    url: `/marketing/leads/${lead.uuid}/assign`,
    payload: {
      assignedTo: "another.rep@example.test",
      expectedRevision: 1
    }
  });
  assert.equal(staleAssign.statusCode, 409, "Stale revision on assign must yield 409 Conflict");

  // Lead Activity check
  const leadActivity = await app.inject({
    method: "GET",
    url: `/marketing/leads/${lead.uuid}/activity`
  });
  assert.equal(leadActivity.statusCode, 200, leadActivity.body);
  const activities = leadActivity.json().data;
  assert.ok(activities.length >= 3);
  assert.ok(activities.some((a: { action: string }) => a.action === "created"));
  assert.ok(activities.some((a: { action: string }) => a.action === "updated"));
  assert.ok(activities.some((a: { action: string }) => a.action.startsWith("assigned")));

  // Status transition to qualified
  const qualifyStatusRes = await app.inject({
    method: "POST",
    url: `/marketing/leads/${lead.uuid}/status`,
    payload: {
      status: "qualified",
      expectedRevision: assignedLead.revision
    }
  });
  assert.equal(qualifyStatusRes.statusCode, 200, qualifyStatusRes.body);
  const qualifiedLead = qualifyStatusRes.json().data;
  assert.equal(qualifiedLead.status, "qualified");

  // Invalid transition rejection: qualified -> new must be rejected with 400
  const invalidTransition = await app.inject({
    method: "POST",
    url: `/marketing/leads/${lead.uuid}/status`,
    payload: {
      status: "new",
      expectedRevision: qualifiedLead.revision
    }
  });
  assert.equal(
    invalidTransition.statusCode,
    400,
    "Transitioning qualified -> new must be rejected as an invalid transition."
  );

  // =========================================================================
  // 3. Marketing Qualification: decisions (qualified, disqualified, deferred), criteria, reason.
  // Verify that only a qualified lead can convert; disqualified/deferred cannot convert.
  // =========================================================================

  // Create lead2 to test disqualified
  const lead2 = await create("/marketing/leads", {
    brandUuid: brand.uuid,
    name: "Disqualified Prospect",
    email: "disqualified@example.test",
    phone: "",
    status: "new"
  });

  const disqualQual = await create("/marketing/qualifications", {
    brandUuid: brand.uuid,
    leadUuid: lead2.uuid,
    decision: "disqualified",
    criteria: "Minimum annual revenue threshold ($1M)",
    reason: "Company annual revenue below $1M threshold",
    notes: "Review again next financial year"
  });
  assert.equal(disqualQual.decision, "disqualified");
  assert.equal(disqualQual.leadUuid, lead2.uuid);

  // Update lead2 status to disqualified
  await app.inject({
    method: "POST",
    url: `/marketing/leads/${lead2.uuid}/status`,
    payload: { status: "disqualified", expectedRevision: lead2.revision }
  });

  // Attempting to convert a disqualified lead MUST be rejected (409)
  const rejectDisqualConvert = await app.inject({
    method: "POST",
    url: "/marketing/conversions",
    payload: {
      brandUuid: brand.uuid,
      leadUuid: lead2.uuid,
      qualificationUuid: disqualQual.uuid,
      declaredValue: 50000,
      currency: "INR"
    }
  });
  assert.equal(
    rejectDisqualConvert.statusCode,
    409,
    "Attempting to convert a disqualified lead must be rejected."
  );

  // Create lead3 to test deferred
  const lead3 = await create("/marketing/leads", {
    brandUuid: brand.uuid,
    name: "Deferred Prospect",
    email: "deferred@example.test",
    phone: "",
    status: "new"
  });

  const deferredQual = await create("/marketing/qualifications", {
    brandUuid: brand.uuid,
    leadUuid: lead3.uuid,
    decision: "deferred",
    criteria: "Q4 budget freeze",
    reason: "Client procurement frozen until Q1 next year",
    notes: "Follow up in January"
  });
  assert.equal(deferredQual.decision, "deferred");

  // Update lead3 status to deferred
  await app.inject({
    method: "POST",
    url: `/marketing/leads/${lead3.uuid}/status`,
    payload: { status: "deferred", expectedRevision: lead3.revision }
  });

  // Attempting to convert a deferred lead MUST be rejected (409)
  const rejectDeferredConvert = await app.inject({
    method: "POST",
    url: "/marketing/conversions",
    payload: {
      brandUuid: brand.uuid,
      leadUuid: lead3.uuid,
      qualificationUuid: deferredQual.uuid,
      declaredValue: 75000,
      currency: "INR"
    }
  });
  assert.equal(
    rejectDeferredConvert.statusCode,
    409,
    "Attempting to convert a deferred lead must be rejected."
  );

  // Create qualification for the qualified lead (lead.uuid)
  const validQual = await create("/marketing/qualifications", {
    brandUuid: brand.uuid,
    leadUuid: lead.uuid,
    decision: "qualified",
    criteria: "Enterprise tier fit, decision maker engaged, budget confirmed",
    reason: "Budget of $50k verified by CFO; target implementation date in 30 days",
    notes: "Ready for sales conversion"
  });
  assert.equal(validQual.decision, "qualified");
  assert.equal(validQual.leadUuid, lead.uuid);
  assert.ok(validQual.reviewer);

  // Qualification activity check
  const qualActivity = await app.inject({
    method: "GET",
    url: `/marketing/qualifications/${validQual.uuid}/activity`
  });
  assert.equal(qualActivity.statusCode, 200);
  assert.ok(qualActivity.json().data.some((a: { action: string }) => a.action === "created"));

  // =========================================================================
  // 4. Marketing Sales Conversion: create from qualified lead, declaredValue, currency,
  // cancellation/reversal with reason. Concurrent/duplicate conversion is idempotent/rejected.
  // =========================================================================
  const conversionPayload = {
    brandUuid: brand.uuid,
    leadUuid: lead.uuid,
    qualificationUuid: validQual.uuid,
    declaredValue: 350000,
    currency: "INR",
    notes: "Enterprise contract finalized"
  };

  const conversion = await create("/marketing/conversions", conversionPayload);
  assert.ok(conversion.uuid);
  assert.equal(conversion.status, "converted");
  assert.equal(conversion.declaredValue, 350000);
  assert.equal(conversion.currency, "INR");
  assert.equal(conversion.leadUuid, lead.uuid);
  assert.equal(conversion.qualificationUuid, validQual.uuid);

  // Idempotent duplicate conversion on same lead: returns the existing converted record
  const duplicateConversion = await create("/marketing/conversions", conversionPayload);
  assert.equal(
    duplicateConversion.uuid,
    conversion.uuid,
    "Duplicate conversion on same lead must return the existing conversion record."
  );

  // Stale revision on conversion cancel yields 409 Conflict
  const staleCancel = await app.inject({
    method: "POST",
    url: `/marketing/conversions/${conversion.uuid}/cancel`,
    payload: { reason: "Stale cancel test", expectedRevision: 999 }
  });
  assert.equal(staleCancel.statusCode, 409, "Stale revision on cancel must yield 409 Conflict.");

  // Conversion activity check
  const convActivity = await app.inject({
    method: "GET",
    url: `/marketing/conversions/${conversion.uuid}/activity`
  });
  assert.equal(convActivity.statusCode, 200);
  assert.ok(convActivity.json().data.some((a: { action: string }) => a.action === "converted"));

  // Test Cancellation on a separate qualified lead
  const leadForCancel = await create("/marketing/leads", {
    brandUuid: brand.uuid,
    name: "Cancel Case Prospect",
    email: "cancel-case@example.test",
    status: "new"
  });
  await app.inject({
    method: "POST",
    url: `/marketing/leads/${leadForCancel.uuid}/status`,
    payload: { status: "qualified", expectedRevision: leadForCancel.revision }
  });
  const qualForCancel = await create("/marketing/qualifications", {
    brandUuid: brand.uuid,
    leadUuid: leadForCancel.uuid,
    decision: "qualified",
    criteria: "Standard package",
    reason: "Initial approval"
  });
  const convForCancel = await create("/marketing/conversions", {
    brandUuid: brand.uuid,
    leadUuid: leadForCancel.uuid,
    qualificationUuid: qualForCancel.uuid,
    declaredValue: 120000,
    currency: "INR"
  });

  const cancelRes = await app.inject({
    method: "POST",
    url: `/marketing/conversions/${convForCancel.uuid}/cancel`,
    payload: {
      reason: "Cooling-off withdrawal",
      expectedRevision: convForCancel.revision
    }
  });
  assert.equal(cancelRes.statusCode, 200, cancelRes.body);
  const cancelledConv = cancelRes.json().data;
  assert.equal(cancelledConv.status, "cancelled");
  assert.equal(cancelledConv.cancellationReason, "Cooling-off withdrawal");

  // Re-converting a cancelled conversion lead must be rejected (409)
  const reConvertCancelled = await app.inject({
    method: "POST",
    url: "/marketing/conversions",
    payload: {
      brandUuid: brand.uuid,
      leadUuid: leadForCancel.uuid,
      qualificationUuid: qualForCancel.uuid,
      declaredValue: 120000,
      currency: "INR"
    }
  });
  assert.equal(reConvertCancelled.statusCode, 409, "Converting a cancelled lead must be rejected.");

  // Test Reversal on another qualified lead
  const leadForReverse = await create("/marketing/leads", {
    brandUuid: brand.uuid,
    name: "Reverse Case Prospect",
    email: "reverse-case@example.test",
    status: "new"
  });
  await app.inject({
    method: "POST",
    url: `/marketing/leads/${leadForReverse.uuid}/status`,
    payload: { status: "qualified", expectedRevision: leadForReverse.revision }
  });
  const qualForReverse = await create("/marketing/qualifications", {
    brandUuid: brand.uuid,
    leadUuid: leadForReverse.uuid,
    decision: "qualified",
    criteria: "Express setup",
    reason: "Signed purchase order"
  });
  const convForReverse = await create("/marketing/conversions", {
    brandUuid: brand.uuid,
    leadUuid: leadForReverse.uuid,
    qualificationUuid: qualForReverse.uuid,
    declaredValue: 200000,
    currency: "INR"
  });

  const reverseRes = await app.inject({
    method: "POST",
    url: `/marketing/conversions/${convForReverse.uuid}/reverse`,
    payload: {
      reason: "Dispute chargeback",
      expectedRevision: convForReverse.revision
    }
  });
  assert.equal(reverseRes.statusCode, 200, reverseRes.body);
  const reversedConv = reverseRes.json().data;
  assert.equal(reversedConv.status, "reversed");
  assert.equal(
    reversedConv.cancellationReason,
    "Dispute chargeback"
  );

  // =========================================================================
  // 5. Marketing Outcome: terminal disposition (won, lost, nurture, unresponsive, withdrawn),
  // deliberate reopen/correction with reference to previous outcome.
  // =========================================================================
  const outcomePayload = {
    brandUuid: brand.uuid,
    leadUuid: lead.uuid,
    qualificationUuid: validQual.uuid,
    conversionUuid: conversion.uuid,
    disposition: "won" as const,
    reason: "Signed multi-year SaaS contract with enterprise tier SLAs",
    notes: "Transitioning to implementation engineering"
  };

  const outcome = await create("/marketing/outcomes", outcomePayload);
  assert.ok(outcome.uuid);
  assert.equal(outcome.disposition, "won");
  assert.equal(outcome.leadUuid, lead.uuid);
  assert.ok(outcome.decidedAt);

  // Attempting second outcome WITHOUT previousOutcomeUuid MUST be rejected with 409 Conflict
  const rejectUnlinkedSecondOutcome = await app.inject({
    method: "POST",
    url: "/marketing/outcomes",
    payload: {
      brandUuid: brand.uuid,
      leadUuid: lead.uuid,
      disposition: "lost",
      reason: "Unilateral contract withdrawal",
      notes: "Attempted unlinked overwrite"
    }
  });
  assert.equal(
    rejectUnlinkedSecondOutcome.statusCode,
    409,
    "Creating duplicate outcome without previousOutcomeUuid must yield 409 Conflict."
  );

  // Deliberate reopen/correction WITH reference to previous outcome MUST succeed
  const correctedOutcome = await create("/marketing/outcomes", {
    brandUuid: brand.uuid,
    leadUuid: lead.uuid,
    qualificationUuid: validQual.uuid,
    conversionUuid: conversion.uuid,
    disposition: "nurture",
    reason: "Client executive transition delayed rollout; shifted to relationship nurture",
    previousOutcomeUuid: outcome.uuid,
    notes: "Approved by VP Marketing"
  });
  assert.ok(correctedOutcome.uuid);
  assert.equal(correctedOutcome.disposition, "nurture");
  assert.equal(correctedOutcome.previousOutcomeUuid, outcome.uuid);

  // Test other terminal dispositions on separate leads
  const dispositions = ["lost", "unresponsive", "withdrawn"] as const;
  for (const disp of dispositions) {
    const dispLead = await create("/marketing/leads", {
      brandUuid: brand.uuid,
      name: `Lead for ${disp}`,
      email: `${disp}@example.test`,
      status: "new"
    });
    const dispOutcome = await create("/marketing/outcomes", {
      brandUuid: brand.uuid,
      leadUuid: dispLead.uuid,
      disposition: disp,
      reason: `Recorded outcome as ${disp} during periodic pipeline review.`
    });
    assert.equal(dispOutcome.disposition, disp);
  }

  // Outcome Activity check
  const outcomeActivity = await app.inject({
    method: "GET",
    url: `/marketing/outcomes/${outcome.uuid}/activity`
  });
  assert.equal(outcomeActivity.statusCode, 200);
  assert.ok(outcomeActivity.json().data.some((a: { action: string }) => a.action.startsWith("recorded:")));

  // =========================================================================
  // 6. Marketing Follow-up: create action/reminder (call, email, meeting, review)
  // with due date, mark complete, activity.
  // =========================================================================
  const followUpDue = new Date(Date.now() + 86400000).toISOString();
  const followUpPayload = {
    brandUuid: brand.uuid,
    leadUuid: lead.uuid,
    actionType: "call" as const,
    subject: "Executive check-in call on security questionnaire",
    notes: "Review SOC2 compliance questions with SecOps lead",
    dueAt: followUpDue,
    assignedTo: "secops.lead@example.test",
    status: "pending" as const
  };

  const followUp = await create("/marketing/follow-ups", followUpPayload);
  assert.ok(followUp.uuid);
  assert.equal(followUp.actionType, "call");
  assert.equal(followUp.status, "pending");
  assert.equal(followUp.assignedTo, "secops.lead@example.test");
  assert.equal(followUp.completedAt, null);

  // Mark follow-up complete
  const completeRes = await app.inject({
    method: "POST",
    url: `/marketing/follow-ups/${followUp.uuid}/complete`,
    payload: { expectedRevision: followUp.revision }
  });
  assert.equal(completeRes.statusCode, 200, completeRes.body);
  const completedFollowUp = completeRes.json().data;
  assert.equal(completedFollowUp.status, "completed");
  assert.ok(completedFollowUp.completedAt);

  // Test other follow-up action types: email, meeting, review
  for (const actionType of ["email", "meeting", "review"] as const) {
    const f = await create("/marketing/follow-ups", {
      brandUuid: brand.uuid,
      leadUuid: lead.uuid,
      actionType,
      subject: `Follow-up ${actionType}`,
      dueAt: followUpDue,
      assignedTo: "agent@example.test"
    });
    assert.equal(f.actionType, actionType);
  }

  // Follow-up Activity check
  const fuActivity = await app.inject({
    method: "GET",
    url: `/marketing/follow-ups/${followUp.uuid}/activity`
  });
  assert.equal(fuActivity.statusCode, 200);
  assert.ok(fuActivity.json().data.some((a: { action: string }) => a.action === "created"));
  assert.ok(fuActivity.json().data.some((a: { action: string }) => a.action === "completed"));

  // =========================================================================
  // 7. Contact Restrictions: Marketing-owned restrictions (restricted, released)
  // checked fail-closed; verify Mail suppression blocks independently.
  // =========================================================================

  // Record a Marketing contact restriction
  const restrictionRecipient = "do-not-contact@example.test";
  const mktRestriction = await create("/marketing/contact-restrictions", {
    recipient: restrictionRecipient,
    channel: "all",
    blocked: true,
    reason: "Recipient invoked privacy opt-out right"
  });
  assert.ok(mktRestriction.uuid);
  assert.equal(mktRestriction.recipient, restrictionRecipient);
  assert.equal(mktRestriction.blocked, true);

  // Check contact restriction endpoint
  const checkMkt = await app.inject({
    method: "POST",
    url: "/marketing/contact-restrictions/check",
    payload: { recipient: restrictionRecipient, channel: "all" }
  });
  assert.equal(checkMkt.statusCode, 200);
  const checkMktData = checkMkt.json().data;
  assert.equal(checkMktData.allowed, false);
  assert.equal(checkMktData.reason, "Recipient invoked privacy opt-out right");

  // Check email-specific channel also blocked by "all" restriction
  const checkEmailChannel = await app.inject({
    method: "POST",
    url: "/marketing/contact-restrictions/check",
    payload: { recipient: restrictionRecipient, channel: "email" }
  });
  assert.equal(checkEmailChannel.json().data.allowed, false);

  // Release contact restriction
  const releaseMkt = await create("/marketing/contact-restrictions", {
    recipient: restrictionRecipient,
    channel: "all",
    blocked: false,
    reason: "Recipient re-opted in via authenticated customer portal"
  });
  assert.equal(releaseMkt.blocked, false);

  const checkReleased = await app.inject({
    method: "POST",
    url: "/marketing/contact-restrictions/check",
    payload: { recipient: restrictionRecipient, channel: "all" }
  });
  assert.equal(checkReleased.json().data.allowed, true);

  // Verify Marketing contact restrictions and Mail suppression block independently in eligibility
  const testBrandForEligibility = brand.uuid;

  // Case A: Marketing restriction blocked alone
  const mktBlockedRecipient = "mkt-blocked-only@example.test";
  await create("/marketing/contact-restrictions", {
    recipient: mktBlockedRecipient,
    channel: "email",
    blocked: true,
    reason: "Marketing-level block"
  });
  // Add grant evidence so consent itself is present
  await create("/marketing/consents", {
    brandUuid: testBrandForEligibility,
    recipient: mktBlockedRecipient,
    channel: "email",
    purpose: "promotional",
    action: "grant",
    noticeVersion: "privacy-v2",
    source: "web-test",
    evidence: "signed-checkbox",
    occurredAt: "2026-03-01T00:00:00Z",
    expiresAt: null,
    requestKey: "mkt-block-grant-key-1"
  });

  const eligMktOnly = await app.inject({
    method: "POST",
    url: "/marketing/consents/eligibility",
    payload: {
      brandUuid: testBrandForEligibility,
      recipient: mktBlockedRecipient,
      channel: "email",
      purpose: "promotional"
    }
  });
  assert.equal(eligMktOnly.statusCode, 200);
  assert.equal(eligMktOnly.json().data.eligible, false);
  assert.ok(
    eligMktOnly.json().data.reasons.some((r: string) => r.startsWith("marketing:Marketing-level block")),
    "Marketing restriction must block eligibility independently."
  );

  // Case B: Mail suppression blocked alone
  const mailBlockedRecipient = "mail-blocked-only@example.test";
  await recordMailSuppression(ctx, {
    recipient: mailBlockedRecipient,
    reason: "hard_bounce",
    evidence: "550 User unknown"
  });
  await create("/marketing/consents", {
    brandUuid: testBrandForEligibility,
    recipient: mailBlockedRecipient,
    channel: "email",
    purpose: "promotional",
    action: "grant",
    noticeVersion: "privacy-v2",
    source: "web-test",
    evidence: "signed-checkbox",
    occurredAt: "2026-03-01T00:00:00Z",
    expiresAt: null,
    requestKey: "mail-block-grant-key-1"
  });

  const eligMailOnly = await app.inject({
    method: "POST",
    url: "/marketing/consents/eligibility",
    payload: {
      brandUuid: testBrandForEligibility,
      recipient: mailBlockedRecipient,
      channel: "email",
      purpose: "promotional"
    }
  });
  assert.equal(eligMailOnly.statusCode, 200);
  assert.equal(eligMailOnly.json().data.eligible, false);
  assert.ok(
    eligMailOnly.json().data.reasons.some((r: string) => r.startsWith("mail:hard_bounce")),
    "Mail suppression must block eligibility independently."
  );

  // Case C: Both blocked - verify neither clears the other
  const bothBlockedRecipient = "both-blocked@example.test";
  await create("/marketing/contact-restrictions", {
    recipient: bothBlockedRecipient,
    channel: "email",
    blocked: true,
    reason: "Dual restriction block"
  });
  await recordMailSuppression(ctx, {
    recipient: bothBlockedRecipient,
    reason: "complaint",
    evidence: "Spam complaint received"
  });
  await create("/marketing/consents", {
    brandUuid: testBrandForEligibility,
    recipient: bothBlockedRecipient,
    channel: "email",
    purpose: "promotional",
    action: "grant",
    noticeVersion: "privacy-v2",
    source: "web-test",
    evidence: "signed-checkbox",
    occurredAt: "2026-03-01T00:00:00Z",
    expiresAt: null,
    requestKey: "both-block-grant-key-1"
  });

  const eligBoth = await app.inject({
    method: "POST",
    url: "/marketing/consents/eligibility",
    payload: {
      brandUuid: testBrandForEligibility,
      recipient: bothBlockedRecipient,
      channel: "email",
      purpose: "promotional"
    }
  });
  assert.equal(eligBoth.statusCode, 200);
  assert.equal(eligBoth.json().data.eligible, false);
  const bothReasons = eligBoth.json().data.reasons;
  assert.ok(
    bothReasons.some((r: string) => r.startsWith("marketing:Dual restriction block")),
    "Marketing restriction must be reported when both are blocked."
  );
  assert.ok(
    bothReasons.some((r: string) => r.startsWith("mail:complaint")),
    "Mail suppression must be reported when both are blocked; neither clears the other."
  );

  // =========================================================================
  // 8. Multi-tenant isolation: database, company, brand swaps yield 403/404 denial
  // with zero foreign data disclosure.
  // =========================================================================

  // Tenant database swap: switch to Tenant 1
  select(1);

  // All Tenant 0 resources must be strictly hidden (404) from Tenant 1
  const foreignLeadGet = await app.inject({
    method: "GET",
    url: `/marketing/leads/${lead.uuid}`
  });
  assert.equal(foreignLeadGet.statusCode, 404, "Tenant 1 must not access Tenant 0 Lead");

  const foreignQualGet = await app.inject({
    method: "GET",
    url: `/marketing/qualifications/${validQual.uuid}`
  });
  assert.equal(foreignQualGet.statusCode, 404, "Tenant 1 must not access Tenant 0 Qualification");

  const foreignConvGet = await app.inject({
    method: "GET",
    url: `/marketing/conversions/${conversion.uuid}`
  });
  assert.equal(foreignConvGet.statusCode, 404, "Tenant 1 must not access Tenant 0 Conversion");

  const foreignOutcomeGet = await app.inject({
    method: "GET",
    url: `/marketing/outcomes/${outcome.uuid}`
  });
  assert.equal(foreignOutcomeGet.statusCode, 404, "Tenant 1 must not access Tenant 0 Outcome");

  const foreignFollowUpGet = await app.inject({
    method: "GET",
    url: `/marketing/follow-ups/${followUp.uuid}`
  });
  assert.equal(foreignFollowUpGet.statusCode, 404, "Tenant 1 must not access Tenant 0 Follow-up");

  // Listing leads on Tenant 1 returns empty list (0 foreign records)
  const tenant1Leads = await app.inject({
    method: "GET",
    url: "/marketing/leads"
  });
  assert.equal(tenant1Leads.statusCode, 200);
  assert.equal(tenant1Leads.json().data.length, 0, "Tenant 1 must have 0 leads from Tenant 0");

  // Company ID swap: switch to Tenant 0, Company 2
  select(0, 2);

  const foreignCompanyLead = await app.inject({
    method: "GET",
    url: `/marketing/leads/${lead.uuid}`
  });
  assert.equal(foreignCompanyLead.statusCode, 404, "Company 2 must not access Company 1 Lead");

  const foreignCompanyList = await app.inject({
    method: "GET",
    url: "/marketing/leads"
  });
  assert.equal(foreignCompanyList.statusCode, 200);
  assert.equal(foreignCompanyList.json().data.length, 0, "Company 2 must see 0 leads");

  // Reset to Tenant 0, Company 1
  select(0, 1);

  // Attempt to create a lead referencing an invalid/foreign brand
  const foreignBrandLead = await app.inject({
    method: "POST",
    url: "/marketing/leads",
    payload: {
      brandUuid: "deadbeef",
      name: "Forged Brand Lead",
      status: "new"
    }
  });
  assert.ok(
    [400, 404].includes(foreignBrandLead.statusCode),
    "Creating lead with non-existent brand must be rejected."
  );

  // Verify database count isolation in MariaDB
  assert.equal(
    Number(
      (
        await sql<{ count: number }>`SELECT COUNT(*) AS count FROM marketing_leads`.execute(
          (await context()).database
        )
      ).rows[0]!.count
    ) > 0,
    true
  );

  select(1);
  assert.equal(
    Number(
      (
        await sql<{ count: number }>`SELECT COUNT(*) AS count FROM marketing_leads`.execute(
          (await context()).database
        )
      ).rows[0]!.count
    ),
    0,
    "Tenant 1 database must contain exactly 0 marketing_leads"
  );

  select(0);
}
