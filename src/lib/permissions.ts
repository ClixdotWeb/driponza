// Granular staff permissions. Checked on the server for every admin page and action –
// hiding buttons in the UI is a convenience only.

export const PERMISSIONS = {
  "dashboard.view": "View dashboard",
  "products.view": "View products",
  "products.create": "Create products",
  "products.edit": "Edit products & prices",
  "products.delete": "Archive / delete products",
  "categories.manage": "Manage categories",
  "inventory.view": "View inventory",
  "inventory.manage": "Adjust stock, batches, suppliers & purchases",
  "orders.view": "View orders",
  "orders.update": "Update order status & shipments",
  "payments.verify": "Verify bank transfers & record COD collections",
  "refunds.approve": "Approve and record refunds",
  "returns.manage": "Manage cancellations & returns",
  "customers.view": "View customers",
  "customers.manage": "Suspend customers, notes, data requests",
  "customers.export": "Export customer data",
  "coupons.manage": "Manage coupons",
  "reviews.moderate": "Moderate reviews",
  "content.manage": "Manage website content",
  "media.manage": "Upload & delete images",
  "reports.view": "View sales & inventory reports",
  "reports.financial": "View financial reports (revenue, tax, profit)",
  "support.manage": "Handle support tickets",
  "staff.manage": "Manage staff accounts & roles",
  "settings.manage": "Manage store settings (payments, shipping, business)",
  "audit.view": "View audit log",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** "*" grants everything (Super Admin). */
export function hasPermission(granted: readonly string[] | null | undefined, needed: Permission) {
  if (!granted) return false;
  return granted.includes("*") || granted.includes(needed);
}

export const SYSTEM_ROLES: Array<{ id: string; name: string; description: string; permissions: string[] }> = [
  { id: "role_super_admin", name: "Super Admin", description: "Full access to every module, staff and settings", permissions: ["*"] },
  {
    id: "role_store_manager",
    name: "Store Manager",
    description: "Runs the store day-to-day; everything except staff, settings and audit",
    permissions: ALL_PERMISSIONS.filter((p) => !["staff.manage", "settings.manage", "audit.view"].includes(p)),
  },
  {
    id: "role_order_manager",
    name: "Order Manager",
    description: "Processes orders, shipments, cancellations and returns",
    permissions: ["dashboard.view", "orders.view", "orders.update", "returns.manage", "payments.verify", "customers.view", "inventory.view", "products.view"],
  },
  {
    id: "role_inventory_manager",
    name: "Inventory Manager",
    description: "Stock, batches, suppliers and purchase entries",
    permissions: ["dashboard.view", "products.view", "inventory.view", "inventory.manage", "reports.view"],
  },
  {
    id: "role_customer_support",
    name: "Customer Support",
    description: "Answers customers, views orders, handles tickets and return requests",
    permissions: ["dashboard.view", "orders.view", "customers.view", "support.manage", "returns.manage", "reviews.moderate"],
  },
  {
    id: "role_content_manager",
    name: "Content Manager",
    description: "Website content, images, product copy and reviews",
    permissions: ["dashboard.view", "products.view", "products.edit", "content.manage", "media.manage", "reviews.moderate", "categories.manage"],
  },
  {
    id: "role_accountant",
    name: "Accountant",
    description: "Payments, refunds and financial reports",
    permissions: ["dashboard.view", "orders.view", "payments.verify", "refunds.approve", "reports.view", "reports.financial", "customers.view"],
  },
];
