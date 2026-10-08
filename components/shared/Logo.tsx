import { cn } from "cn";
import Image from "next/image";

interface logoProps {
  size?: "small" | "medium" | "large";
  title?: boolean;
  subtitle?: boolean;
  className?: string;
}

export default function Logo({
  size = "medium",
  title = false,
  subtitle = false,
  className,
}: logoProps) {
  const { width, height } =
    size === "small"
      ? { width: 45, height: 48 }
      : size === "medium"
        ? { width: 55, height: 58 }
        : { width: 151, height: 157 };

  const { titleSize, subtitleSize } =
    size === "small"
      ? { titleSize: "text-sm", subtitleSize: "text-xs" }
      : size === "medium"
        ? { titleSize: "text-3xl", subtitleSize: "text-xl" }
        : { titleSize: "text-4xl", subtitleSize: "text-2xl" };
  return (
    <div
      id="logo"
      aria-label="Logo"
      className={cn("flex flex-col items-center", className)}
    >
      <Image src="/logo/logo.svg" alt="Logo" width={width} height={height} />
      {title && (
        <h1
          className={`w-max text-primary to-90% ${titleSize} font-bold mt-4`}
          dir="ltr"
        >
          PharmaShiva
        </h1>
      )}
      {subtitle && (
        <p className={`text-primary ${subtitleSize} mt-0.5 text-bold`}>
          Your Pharmacy AI Assistant
        </p>
      )}
    </div>
  );
}
