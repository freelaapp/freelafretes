import logoAsset from "@/assets/freela-fretes-logo.png.asset.json";

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  variant?: "default" | "onDark";
}

export function Logo({ size = 36, showWordmark = true, className = "", variant = "default" }: LogoProps) {
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
          className={`font-display tracking-wide text-xl leading-none ${variant === "onDark" ? "text-primary-foreground" : "text-foreground"}`}
        >
          freeLa <span className="text-accent">Fretes</span>
        </span>
      )}
    </div>
  );
}
