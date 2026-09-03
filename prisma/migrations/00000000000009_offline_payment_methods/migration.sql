-- H8: staff-recorded offline donations (cash / paper check).
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older
-- Postgres; each statement is idempotent via IF NOT EXISTS.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CASH';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHECK';
