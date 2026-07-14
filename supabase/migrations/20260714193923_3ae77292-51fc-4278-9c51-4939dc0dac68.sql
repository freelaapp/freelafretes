
CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'open_freights', (SELECT count(*) FROM public.freights WHERE status = 'OPEN'),
    'drivers', (SELECT count(*) FROM public.providers WHERE COALESCE(is_banned, false) = false),
    'total_km', (SELECT COALESCE(SUM(distance_km), 0) FROM public.freights),
    'gmv_cents', (SELECT COALESCE(SUM(agreed_amount_in_cents), 0) FROM public.jobs WHERE status = 'COMPLETED')
  );
$$;

GRANT EXECUTE ON FUNCTION public.public_stats() TO anon, authenticated;
