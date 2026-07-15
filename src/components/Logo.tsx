import logoAsset from "@/assets/freela-fretes-logo.png.asset.json";

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  variant?: "default" | "onDark" | "onOrange";
}

export function Logo({ size = 36, showWordmark = true, className = "", variant = "default" }: LogoProps) {
  const wordmarkColor =
    variant === "onDark" || variant === "onOrange" ? "text-white" : "text-accent";
  const accentColor =
    variant === "onOrange" ? "text-white/90" : variant === "onDark" ? "text-primary" : "text-primary";

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logoAsset.url}
        alt="Freela Fretes"
        width={size}
        height={size}
        className="object-contain"
        style={{ height: size, width: size }}
      />
      {showWordmark && (
        <span
          className={`font-display leading-none ${wordmarkColor}`}
          style={{ fontSize: size * 0.5, fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          Freela <span className={accentColor}>Fretes</span>
        </span>
      )}
    </div>
  );
}
