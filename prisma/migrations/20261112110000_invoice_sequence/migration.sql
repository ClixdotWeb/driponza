-- Gap-free, concurrency-safe invoice numbering (used by nextInvoice()).
CREATE SEQUENCE IF NOT EXISTS "invoice_number_seq" START 1;
