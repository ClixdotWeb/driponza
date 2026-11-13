export type TourStep = {
  /** CSS selector for the element to spotlight. Omit for a centred card. */
  target?: string;
  title: string;
  body: string;
};

export type Tour = { id: string; label: string; steps: TourStep[] };

/**
 * Each admin page can teach itself. A step whose target is not on the page is
 * skipped automatically, so these stay safe when a page changes.
 */
const TOURS: Array<{ match: (path: string) => boolean; tour: Tour }> = [
  {
    match: (p) => p === "/admin",
    tour: {
      id: "dashboard-v1",
      label: "Dashboard tour",
      steps: [
        {
          title: "Welcome to your admin",
          body: "A quick walk through the screen — under a minute. You can leave at any point and start it again from the ? button at the top.",
        },
        {
          target: '[data-tour="nav"]',
          title: "Everything lives here",
          body: "Orders, products, inventory, customers and settings. Hover the rail and it opens up with the names.",
        },
        {
          target: '[data-tour="range"]',
          title: "Pick a period",
          body: "Every number and chart below follows this. Switch between today, this week, this month or the year.",
        },
        {
          target: '[data-tour="kpis"]',
          title: "The four numbers that matter",
          body: "Revenue, orders, average order value and new customers for the period you picked.",
        },
        {
          target: '[data-tour="view-site"]',
          title: "See what customers see",
          body: "Opens the live shop in a new tab, so you can check a change straight after making it.",
        },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/admin/products"),
    tour: {
      id: "products-v1",
      label: "Products tour",
      steps: [
        {
          target: '[data-tour="new-product"]',
          title: "Add a product",
          body: "Name, category, description and at least one weight with a price. Images come after you save it the first time.",
        },
        {
          target: '[data-tour="product-filters"]',
          title: "Find one quickly",
          body: "Search by name or SKU, or narrow by category and status. “Needs review” shows the ones imported from the old site that still need checking.",
        },
        {
          target: '[data-tour="product-table"]',
          title: "The catalogue",
          body: "Price shown is the cheapest weight. A red stock figure means nothing is left to sell. Click any name to edit it.",
        },
        {
          target: '[data-tour="product-actions"]',
          title: "Two shortcuts per row",
          body: "The pencil opens the editor; the arrow opens that product on the live shop in a new tab.",
        },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/admin/inventory"),
    tour: {
      id: "inventory-v1",
      label: "Inventory tour",
      steps: [
        {
          target: '[data-tour="inv-stats"]',
          title: "Stock at a glance",
          body: "How many variants you sell, how many are finished, how much is held by open orders, and what the shelf is worth at cost.",
        },
        {
          target: '[data-tour="inv-tabs"]',
          title: "Six views",
          body: "Stock is the day-to-day one. Batches tracks expiry, Purchases records goods received, and History logs every single change.",
        },
        {
          target: '[data-tour="inv-filters"]',
          title: "Jump to what needs you",
          body: "The counts tell you how many are out of stock or running low before you click.",
        },
        {
          target: '[data-tour="inv-table"]',
          title: "Reading a row",
          body: "The coloured bar and big number are the sellable count. Reserved is held by orders not yet shipped — it has already left the stock figure.",
        },
        {
          target: '[data-tour="inv-adjust"]',
          title: "New stock arrived?",
          body: "Type how many units and press Add to stock. It is logged in History with your name, so you can always see who changed what.",
        },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/admin/orders"),
    tour: {
      id: "orders-v1",
      label: "Orders tour",
      steps: [
        {
          target: '[data-tour="order-tabs"]',
          title: "Work through the stages",
          body: "Orders move left to right: new, paid, packed, shipped, delivered. The count on each tab is your to-do list.",
        },
        {
          target: '[data-tour="order-table"]',
          title: "Every order",
          body: "Click a row to open it — there you confirm payment, print the invoice, add a tracking number and change the status.",
        },
      ],
    },
  },
];

export function tourFor(pathname: string): Tour | null {
  return TOURS.find((t) => t.match(pathname))?.tour ?? null;
}
