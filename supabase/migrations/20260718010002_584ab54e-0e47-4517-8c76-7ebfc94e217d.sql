
UPDATE public.payments
SET status = 'HELD', held_at = COALESCE(held_at, paid_at, now())
WHERE status = 'COMPLETED';
