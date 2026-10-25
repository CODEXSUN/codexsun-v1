/**
 * Ecommerce Local Shopping Cart & AUDIT A14 Boundary Protection
 *
 * Boundary Rule:
 * Staff catalog and publishing parity are strictly distinct from customer purchasing.
 * The public shopping cart is local client-side state only for storefront preview.
 * Backend checkout, payment gateway, and stock reservation are explicitly excluded
 * from staff parity and tracked under future phase EC1.
 */

import type { LocalCartState, StorefrontCartItem } from "./types.js";

export class EcommerceBoundaryViolationError extends Error {
  public readonly attemptedAction: string;
  public readonly targetPhase: string;

  constructor(attemptedAction: string) {
    super(
      `Boundary violation (AUDIT A14): Action '${attemptedAction}' is part of customer purchasing, ` +
        "which is excluded from staff mobile catalog parity. Server checkout, payment gateways, " +
        "and stock reservation remain tracked under future phase EC1."
    );
    this.name = "EcommerceBoundaryViolationError";
    this.attemptedAction = attemptedAction;
    this.targetPhase = "EC1";
  }
}

/**
 * Asserts that an action is valid within staff catalog & publishing parity.
 * Explicitly rejects backend checkout, payments, and stock reservation.
 */
export function assertStaffParityBoundary(action: "checkout" | "payment" | "stock_reservation" | string): void {
  const prohibitedActions = new Set(["checkout", "payment", "stock_reservation", "charge", "reserve_stock"]);
  if (prohibitedActions.has(action.toLowerCase())) {
    throw new EcommerceBoundaryViolationError(action);
  }
}

/**
 * Local in-memory / storage shopping cart for storefront preview demonstration.
 */
export class StorefrontPreviewCartManager {
  private items: StorefrontCartItem[] = [];

  constructor(initialItems: StorefrontCartItem[] = []) {
    this.items = [...initialItems];
  }

  public getItems(): StorefrontCartItem[] {
    return [...this.items];
  }

  public addItem(item: Omit<StorefrontCartItem, "quantity"> & { quantity?: number }): void {
    const qty = Math.max(1, item.quantity ?? 1);
    const existing = this.items.find((i) => i.slug === item.slug);
    if (existing) {
      existing.quantity += qty;
    } else {
      this.items.push({
        imageAlt: item.imageAlt,
        imageUrl: item.imageUrl,
        name: item.name,
        price: item.price,
        quantity: qty,
        slug: item.slug
      });
    }
  }

  public updateQuantity(slug: string, quantity: number): void {
    const target = this.items.find((i) => i.slug === slug);
    if (!target) return;
    if (quantity <= 0) {
      this.removeItem(slug);
    } else {
      target.quantity = quantity;
    }
  }

  public removeItem(slug: string): void {
    this.items = this.items.filter((i) => i.slug !== slug);
  }

  public clear(): void {
    this.items = [];
  }

  public getState(): LocalCartState {
    const totalCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      isServerCheckoutSupported: false,
      items: this.getItems(),
      subtotal: Math.round(subtotal * 100) / 100,
      totalCount
    };
  }
}
