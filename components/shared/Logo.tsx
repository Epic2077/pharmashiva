import { cn } from "cn";
import Image from "next/image";

interface logoProps {
  size?: "small" | "medium" | "large";
  title?: boolean;
  subtitle?: boolean;
  className?: React.ComponentProps<"div">["className"];
}

export default function Logo({
  size = "medium",
  title = false,
  subtitle = false,
  className,
}: logoProps) {
  const { width, height } =
    size === "small"
      ? { width: 50, height: 53 }
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
      className={cn("flex flex-col items-center gap-4", className)}
    >
      <Image src="/logo/logo.svg" alt="Logo" width={width} height={height} />
      {(title || subtitle) && (
        <div className="flex flex-col items-center gap-0.5">
          {title && (
            <h1
              className={`w-max text-primary to-90% ${titleSize} font-bold`}
              dir="ltr"
            >
              PharmaShiva
            </h1>
          )}
          {subtitle && (
            <p className={`text-primary ${subtitleSize} text-bold`}>
              Your Pharmacy AI Assistant
            </p>
          )}
        </div>
      )}
    </div>
  );
}
