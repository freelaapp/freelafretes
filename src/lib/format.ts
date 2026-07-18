// Utilitários de formatação e validação pt-BR

export function formatBRL(cents: number | null | undefined): string {
  if (cents == null) return "R$ 0,00";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function reaisToCents(value: string | number): number {
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(/\./g, "").replace(",", "."));
  return Math.round((isFinite(num) ? num : 0) * 100);
}

export function formatDateBR(iso: string | Date | null | undefined): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTimeBR(iso: string | Date | null | undefined): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ---- Máscaras ----
export function maskCPF(v: string): string {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCNPJ(v: string): string {
  return v.replace(/\D/g, "").slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
}

export function maskCEP(v: string): string {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

// Placa Mercosul ABC1D23
export function maskPlate(v: string): string {
  const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  return clean;
}

// ---- Validações ----
export function isValidCPF(cpfStr: string): boolean {
  const cpf = cpfStr.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = 11 - (sum % 11); if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = 11 - (sum % 11); if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}

export function isValidCNPJ(cnpjStr: string): boolean {
  const cnpj = cnpjStr.replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    let s = 0;
    for (let i = 0; i < weights.length; i++) s += parseInt(base[i]) * weights[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj, w1);
  const d2 = calc(cnpj, w2);
  return d1 === parseInt(cnpj[12]) && d2 === parseInt(cnpj[13]);
}

export function isValidPlate(p: string): boolean {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p.toUpperCase());
}

// Código 6 chars sem 0/O/1/I
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function normalizeCode(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

// ---- Senha ----
export function isStrongPassword(pw: string): boolean {
  if (pw.length < 8) return false;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  return hasLetter && hasNumber;
}

/** Traduz erros comuns do Supabase Auth para PT-BR amigável. */
export function friendlyAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const low = msg.toLowerCase();
  if (low.includes("weak_password") || low.includes("known to be weak") || low.includes("pwned")) {
    return "Senha muito fraca ou já vazada em outros sites. Escolha uma senha forte (mín. 8 caracteres, misture letras, números e símbolos).";
  }
  if (low.includes("already registered") || low.includes("already been registered") || low.includes("user already")) {
    return "Este e-mail já está cadastrado. Faça login ou use outro e-mail.";
  }
  if (low.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (low.includes("email rate limit") || low.includes("over_email_send_rate_limit")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }
  if (low.includes("invalid email")) {
    return "E-mail inválido.";
  }
  return msg || "Erro inesperado";
}

