export const VEHICLE_TYPES = ["VLC", "Toco", "Truck", "Bitruck", "Carreta", "Bitrem", "Rodotrem"] as const;
export const BODY_TYPES = ["Baú", "Sider", "Graneleiro", "Grade Baixa", "Prancha", "Frigorífica", "Tanque", "Caçamba"] as const;
export const CARGO_TYPES = [
  "Grãos",
  "Carga Paletizada",
  "Granel Líquido",
  "Carga Refrigerada",
  "Mudança",
  "Veículos",
  "Container",
  "Outros",
] as const;
export const CNH_CATEGORIES = ["C", "D", "E"] as const;
export const SEGMENTS = [
  "Agronegócio",
  "Indústria",
  "Varejo/Distribuição",
  "Construção",
  "Transportadora",
  "Outro",
] as const;
export const MONTHLY_VOLUMES = ["1-10", "11-50", "51-200", "200+"] as const;
export const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
] as const;

export const SERVICE_FEE_BPS = 1000; // 10%

export const BANK_OPTIONS = [
  { code: "001", name: "Banco do Brasil" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú" },
  { code: "033", name: "Santander" },
  { code: "260", name: "Nubank" },
  { code: "077", name: "Inter" },
  { code: "336", name: "C6 Bank" },
  { code: "212", name: "Banco Original" },
  { code: "290", name: "PagBank" },
  { code: "323", name: "Mercado Pago" },
  { code: "756", name: "Sicoob" },
  { code: "748", name: "Sicredi" },
  { code: "208", name: "BTG Pactual" },
  { code: "422", name: "Safra" },
  { code: "735", name: "Neon" },
  { code: "070", name: "BRB" },
] as const;

export const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
] as const;

