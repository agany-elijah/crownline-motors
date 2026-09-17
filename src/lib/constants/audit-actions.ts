import type { AuditAction } from "@/lib/audit"

/**
 * How the Security Activity log names each recorded action, and the groups
 * its filter offers.
 *
 * Typed as a complete Record over AuditAction, so adding an action code to
 * audit.ts without giving it a name here fails the build instead of rendering
 * a raw `SPARE_PART_STOCK_RELEASED` in front of an operator.
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  ADMIN_SIGNED_IN: "Signed in",
  ADMIN_SIGNED_OUT: "Signed out",
  ADMIN_PASSWORD_RESET_REQUESTED: "Password reset requested",
  ADMIN_PASSWORD_CHANGED: "Password changed",
  ADMIN_PROFILE_UPDATED: "Account name changed",
  ADMIN_EMAIL_CHANGE_REQUESTED: "Email change requested",
  ADMIN_EMAIL_CHANGED: "Email address changed",
  ADMIN_TWO_FACTOR_ENABLED: "2FA enabled",
  ADMIN_TWO_FACTOR_DISABLED: "2FA disabled",
  ADMIN_SESSION_REVOKED: "Session signed out remotely",
  ADMIN_OTHER_SESSIONS_REVOKED: "Other sessions signed out",
  ADMIN_ALL_SESSIONS_REVOKED: "All sessions signed out",

  BUSINESS_SETTINGS_UPDATED: "Settings changed",
  SETTINGS_BUSINESS_INFORMATION_UPDATED: "Business information changed",
  SETTINGS_BRANDING_UPDATED: "Branding changed",
  SETTINGS_BRANDING_ASSET_UPDATED: "Brand image uploaded",
  SETTINGS_BRANDING_ASSET_REMOVED: "Brand image removed",
  SETTINGS_PAYMENT_SCHEDULE_UPDATED: "Payment schedule changed",
  SETTINGS_ORDERS_TRACKING_UPDATED: "Tracking settings changed",
  SETTINGS_CATALOG_DISPLAY_UPDATED: "Catalogue display changed",
  SETTINGS_NOTIFICATIONS_UPDATED: "Notification settings changed",
  SETTINGS_SEO_UPDATED: "SEO settings changed",
  SETTINGS_SECURITY_UPDATED: "Security controls changed",

  VEHICLE_CREATED: "Vehicle created",
  VEHICLE_UPDATED: "Vehicle edited",
  VEHICLE_STATUS_CHANGED: "Vehicle status changed",
  VEHICLE_PHOTOS_UPLOADED: "Vehicle photos uploaded",
  VEHICLE_PHOTO_UPDATED: "Vehicle photo edited",
  VEHICLE_PHOTOS_REORDERED: "Vehicle photos reordered",
  VEHICLE_PHOTO_DELETED: "Vehicle photo deleted",
  VEHICLE_PRIMARY_PHOTO_CHANGED: "Vehicle main photo changed",

  SPARE_PART_CREATED: "Spare part created",
  SPARE_PART_UPDATED: "Spare part edited",
  SPARE_PART_STATUS_CHANGED: "Spare part status changed",
  SPARE_PART_PHOTOS_UPLOADED: "Spare part photos uploaded",
  SPARE_PART_PHOTOS_REORDERED: "Spare part photos reordered",
  SPARE_PART_PHOTO_DELETED: "Spare part photo deleted",
  SPARE_PART_PRIMARY_PHOTO_CHANGED: "Spare part main photo changed",
  SPARE_PART_FITMENT_ADDED: "Fitment added",
  SPARE_PART_FITMENT_REMOVED: "Fitment removed",
  SPARE_PART_STOCK_RESERVED: "Stock reserved",
  SPARE_PART_STOCK_RELEASED: "Stock released",

  QUOTE_DETAILS_UPDATED: "Quote edited",
  QUOTE_STATUS_CHANGED: "Quote status changed",
  QUOTE_SENT: "Quote sent",
  QUOTE_LINK_CREATED: "Quote link created",
  QUOTE_LINK_REVOKED: "Quote link revoked",
  QUOTE_CONVERTED: "Quote converted to order",

  ORDER_CREATED: "Order created",
  ORDER_CANCELLED: "Order cancelled",
  ORDER_STATUS_CHANGED: "Order status changed",
  ORDER_DELIVERY_DATE_UPDATED: "Delivery date changed",
  PAYMENT_RECORDED: "Payment recorded",
  PAYMENT_REVERSED: "Payment reversed",

  SHIPMENT_CREATED: "Tracking activated",
  TRACKING_EVENT_ADDED: "Tracking updated",
  TRACKING_EVENT_VOIDED: "Tracking update voided",
}

export const AUDIT_CATEGORIES = {
  security: {
    label: "Security & accounts",
    actions: [
      "ADMIN_SIGNED_IN",
      "ADMIN_SIGNED_OUT",
      "ADMIN_PASSWORD_RESET_REQUESTED",
      "ADMIN_PASSWORD_CHANGED",
      "ADMIN_PROFILE_UPDATED",
      "ADMIN_EMAIL_CHANGE_REQUESTED",
      "ADMIN_EMAIL_CHANGED",
      "ADMIN_TWO_FACTOR_ENABLED",
      "ADMIN_TWO_FACTOR_DISABLED",
      "ADMIN_SESSION_REVOKED",
      "ADMIN_OTHER_SESSIONS_REVOKED",
      "ADMIN_ALL_SESSIONS_REVOKED",
      "SETTINGS_SECURITY_UPDATED",
    ],
  },
  settings: {
    label: "Settings",
    actions: [
      "BUSINESS_SETTINGS_UPDATED",
      "SETTINGS_BUSINESS_INFORMATION_UPDATED",
      "SETTINGS_BRANDING_UPDATED",
      "SETTINGS_BRANDING_ASSET_UPDATED",
      "SETTINGS_BRANDING_ASSET_REMOVED",
      "SETTINGS_PAYMENT_SCHEDULE_UPDATED",
      "SETTINGS_ORDERS_TRACKING_UPDATED",
      "SETTINGS_CATALOG_DISPLAY_UPDATED",
      "SETTINGS_NOTIFICATIONS_UPDATED",
      "SETTINGS_SEO_UPDATED",
    ],
  },
  inventory: {
    label: "Vehicles & spare parts",
    actions: [
      "VEHICLE_CREATED",
      "VEHICLE_UPDATED",
      "VEHICLE_STATUS_CHANGED",
      "VEHICLE_PHOTOS_UPLOADED",
      "VEHICLE_PHOTO_UPDATED",
      "VEHICLE_PHOTOS_REORDERED",
      "VEHICLE_PHOTO_DELETED",
      "VEHICLE_PRIMARY_PHOTO_CHANGED",
      "SPARE_PART_CREATED",
      "SPARE_PART_UPDATED",
      "SPARE_PART_STATUS_CHANGED",
      "SPARE_PART_PHOTOS_UPLOADED",
      "SPARE_PART_PHOTOS_REORDERED",
      "SPARE_PART_PHOTO_DELETED",
      "SPARE_PART_PRIMARY_PHOTO_CHANGED",
      "SPARE_PART_FITMENT_ADDED",
      "SPARE_PART_FITMENT_REMOVED",
      "SPARE_PART_STOCK_RESERVED",
      "SPARE_PART_STOCK_RELEASED",
    ],
  },
  sales: {
    label: "Quotes, orders & payments",
    actions: [
      "QUOTE_DETAILS_UPDATED",
      "QUOTE_STATUS_CHANGED",
      "QUOTE_SENT",
      "QUOTE_LINK_CREATED",
      "QUOTE_LINK_REVOKED",
      "QUOTE_CONVERTED",
      "ORDER_CREATED",
      "ORDER_CANCELLED",
      "ORDER_STATUS_CHANGED",
      "ORDER_DELIVERY_DATE_UPDATED",
      "PAYMENT_RECORDED",
      "PAYMENT_REVERSED",
    ],
  },
  logistics: {
    label: "Tracking",
    actions: ["SHIPMENT_CREATED", "TRACKING_EVENT_ADDED", "TRACKING_EVENT_VOIDED"],
  },
} as const satisfies Record<string, { label: string; actions: readonly AuditAction[] }>

export type AuditCategory = keyof typeof AUDIT_CATEGORIES

export function isAuditCategory(value: string | undefined): value is AuditCategory {
  return value !== undefined && Object.hasOwn(AUDIT_CATEGORIES, value)
}

/** The label for a stored action code — tolerant of codes from an older build. */
export function auditActionLabel(action: string): string {
  return (AUDIT_ACTION_LABELS as Record<string, string>)[action] ?? humaniseCode(action)
}

/** "DEPOSIT_CONFIRMED" → "Deposit confirmed". */
export function humaniseCode(value: string): string {
  const words = value.toLowerCase().split("_").filter(Boolean).join(" ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}
