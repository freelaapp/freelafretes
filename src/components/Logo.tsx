import fullLogoAsset from "@/assets/freela-fretes-logo.png.asset.json";
import iconAsset from "@/assets/freela-fretes-icon.png.asset.json";

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  variant?: "default" | "onDark" | "onOrange";
}

export function Logo({
  size = 36,
  showWordmark = true,
  className = "",
  variant = "default",
}: LogoProps) {
  const isDark = variant === "onDark" || variant === "onOrange";
  const wordmarkColor = isDark ? "text-white" : "text-accent";
  const accentColor = variant === "onOrange" ? "text-white/90" : variant === "onDark" ? "text-primary" : "text-primary";

  if (showWordmark && !isDark) {
    return (
      <img
        src={fullLogoAsset.url}
        alt="Freela Fretes"
        width={size}
        height={size}
        className={`object-contain ${className}`}
        style={{ height: size, width: "auto" }}
      />
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={iconAsset.url}
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
