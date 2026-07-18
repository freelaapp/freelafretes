
-- BLOCO 4
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'HELD';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS held_at timestamptz;

-- BLOCO 5
ALTER TABLE public.freights
  ADD COLUMN IF NOT EXISTS origin_lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS origin_lng numeric(9,6),
  ADD COLUMN IF NOT EXISTS destination_lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS destination_lng numeric(9,6);

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS base_lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS base_lng numeric(9,6),
  ADD COLUMN IF NOT EXISTS search_radius_km int NOT NULL DEFAULT 300;

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.br_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  city_normalized text NOT NULL,
  uf char(2) NOT NULL,
  lat numeric(9,6) NOT NULL,
  lng numeric(9,6) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_normalized, uf)
);

GRANT SELECT ON public.br_cities TO anon, authenticated;
GRANT ALL ON public.br_cities TO service_role;
ALTER TABLE public.br_cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "br_cities read all" ON public.br_cities FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS br_cities_uf_idx ON public.br_cities (uf);
CREATE INDEX IF NOT EXISTS br_cities_norm_idx ON public.br_cities (city_normalized, uf);

CREATE OR REPLACE FUNCTION public.normalize_city_name(t text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT lower(regexp_replace(extensions.unaccent(coalesce(t, '')), '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.haversine_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT (2 * 6371 * asin(sqrt(
    power(sin(radians(($3 - $1) / 2)), 2) +
    cos(radians($1)) * cos(radians($3)) * power(sin(radians(($4 - $2) / 2)), 2)
  )))::numeric
$$;

INSERT INTO public.br_cities (city, city_normalized, uf, lat, lng) VALUES
('São Paulo','sao paulo','SP',-23.5505,-46.6333),
('Rio de Janeiro','rio de janeiro','RJ',-22.9068,-43.1729),
('Brasília','brasilia','DF',-15.7801,-47.9292),
('Salvador','salvador','BA',-12.9714,-38.5014),
('Fortaleza','fortaleza','CE',-3.7319,-38.5267),
('Belo Horizonte','belo horizonte','MG',-19.9167,-43.9345),
('Manaus','manaus','AM',-3.1190,-60.0217),
('Curitiba','curitiba','PR',-25.4284,-49.2733),
('Recife','recife','PE',-8.0476,-34.8770),
('Goiânia','goiania','GO',-16.6869,-49.2648),
('Belém','belem','PA',-1.4558,-48.5039),
('Porto Alegre','porto alegre','RS',-30.0346,-51.2177),
('Guarulhos','guarulhos','SP',-23.4543,-46.5339),
('Campinas','campinas','SP',-22.9099,-47.0626),
('São Luís','sao luis','MA',-2.5297,-44.3028),
('Maceió','maceio','AL',-9.6498,-35.7089),
('Campo Grande','campo grande','MS',-20.4697,-54.6201),
('Natal','natal','RN',-5.7945,-35.2110),
('Teresina','teresina','PI',-5.0919,-42.8034),
('João Pessoa','joao pessoa','PB',-7.1195,-34.8450),
('São Bernardo do Campo','sao bernardo do campo','SP',-23.6939,-46.5654),
('Santo André','santo andre','SP',-23.6636,-46.5383),
('Osasco','osasco','SP',-23.5325,-46.7917),
('São José dos Campos','sao jose dos campos','SP',-23.2237,-45.9009),
('Ribeirão Preto','ribeirao preto','SP',-21.1704,-47.8103),
('Uberlândia','uberlandia','MG',-18.9186,-48.2772),
('Sorocaba','sorocaba','SP',-23.5015,-47.4526),
('Contagem','contagem','MG',-19.9317,-44.0536),
('Aracaju','aracaju','SE',-10.9472,-37.0731),
('Feira de Santana','feira de santana','BA',-12.2664,-38.9663),
('Cuiabá','cuiaba','MT',-15.6014,-56.0979),
('Joinville','joinville','SC',-26.3044,-48.8487),
('Juiz de Fora','juiz de fora','MG',-21.7642,-43.3496),
('Londrina','londrina','PR',-23.3103,-51.1628),
('Niterói','niteroi','RJ',-22.8834,-43.1036),
('Porto Velho','porto velho','RO',-8.7612,-63.9004),
('Serra','serra','ES',-20.1288,-40.3079),
('Caxias do Sul','caxias do sul','RS',-29.1678,-51.1794),
('Macapá','macapa','AP',0.0389,-51.0664),
('Florianópolis','florianopolis','SC',-27.5949,-48.5482),
('Vila Velha','vila velha','ES',-20.3419,-40.2925),
('Betim','betim','MG',-19.9678,-44.1980),
('Campina Grande','campina grande','PB',-7.2306,-35.8811),
('Boa Vista','boa vista','RR',2.8235,-60.6758),
('Jundiaí','jundiai','SP',-23.1857,-46.8978),
('Olinda','olinda','PE',-8.0084,-34.8553),
('Piracicaba','piracicaba','SP',-22.7253,-47.6492),
('Montes Claros','montes claros','MG',-16.7286,-43.8583),
('Rio Branco','rio branco','AC',-9.9750,-67.8243),
('Anápolis','anapolis','GO',-16.3281,-48.9528),
('Bauru','bauru','SP',-22.3149,-49.0603),
('Vitória','vitoria','ES',-20.3155,-40.3128),
('Palmas','palmas','TO',-10.1689,-48.3317),
('Blumenau','blumenau','SC',-26.9155,-49.0709),
('Pelotas','pelotas','RS',-31.7649,-52.3376),
('Canoas','canoas','RS',-29.9177,-51.1839),
('Ponta Grossa','ponta grossa','PR',-25.0916,-50.1583),
('Foz do Iguaçu','foz do iguacu','PR',-25.5478,-54.5882),
('Cascavel','cascavel','PR',-24.9555,-53.4552),
('Maringá','maringa','PR',-23.4273,-51.9375),
('Santos','santos','SP',-23.9608,-46.3336),
('São José do Rio Preto','sao jose do rio preto','SP',-20.8113,-49.3758),
('Petrolina','petrolina','PE',-9.3891,-40.5030),
('Vitória da Conquista','vitoria da conquista','BA',-14.8611,-40.8442),
('Uberaba','uberaba','MG',-19.7476,-47.9319),
('Marabá','maraba','PA',-5.3688,-49.1177),
('Chapecó','chapeco','SC',-27.0965,-52.6183),
('Criciúma','criciuma','SC',-28.6774,-49.3695),
('Itajaí','itajai','SC',-26.9077,-48.6618),
('Santa Maria','santa maria','RS',-29.6842,-53.8069),
('Rio Grande','rio grande','RS',-32.0350,-52.0986),
('Novo Hamburgo','novo hamburgo','RS',-29.6875,-51.1305),
('Dourados','dourados','MS',-22.2231,-54.8120),
('Sinop','sinop','MT',-11.8608,-55.5052),
('Rondonópolis','rondonopolis','MT',-16.4706,-54.6357),
('Várzea Grande','varzea grande','MT',-15.6467,-56.1326),
('Imperatriz','imperatriz','MA',-5.5265,-47.4776),
('Caucaia','caucaia','CE',-3.7361,-38.6531),
('Mossoró','mossoro','RN',-5.1875,-37.3444),
('Arapiraca','arapiraca','AL',-9.7527,-36.6611),
('Volta Redonda','volta redonda','RJ',-22.5231,-44.1041),
('Petrópolis','petropolis','RJ',-22.5050,-43.1789),
('Cabo Frio','cabo frio','RJ',-22.8794,-42.0182),
('Campos dos Goytacazes','campos dos goytacazes','RJ',-21.7621,-41.3181),
('Barueri','barueri','SP',-23.5107,-46.8763),
('Taubaté','taubate','SP',-23.0264,-45.5556),
('Limeira','limeira','SP',-22.5647,-47.4017),
('Guarujá','guaruja','SP',-23.9911,-46.2564),
('Mogi das Cruzes','mogi das cruzes','SP',-23.5225,-46.1878),
('Presidente Prudente','presidente prudente','SP',-22.1207,-51.3889),
('Araraquara','araraquara','SP',-21.7845,-48.1780),
('Marília','marilia','SP',-22.2137,-49.9457),
('Divinópolis','divinopolis','MG',-20.1444,-44.8912),
('Ipatinga','ipatinga','MG',-19.4682,-42.5462),
('Cachoeiro de Itapemirim','cachoeiro de itapemirim','ES',-20.8489,-41.1128),
('Passo Fundo','passo fundo','RS',-28.2628,-52.4067),
('São Leopoldo','sao leopoldo','RS',-29.7592,-51.1478),
('Itabuna','itabuna','BA',-14.7856,-39.2803),
('Juazeiro','juazeiro','BA',-9.4166,-40.4986),
('Sobral','sobral','CE',-3.6889,-40.3489),
('Barreiras','barreiras','BA',-12.1526,-44.9964),
('Governador Valadares','governador valadares','MG',-18.8546,-41.9553)
ON CONFLICT (city_normalized, uf) DO NOTHING;

-- BLOCO 6
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS driver_ack_at timestamptz,
  ADD COLUMN IF NOT EXISTS ack_notes text;
