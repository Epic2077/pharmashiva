interface TitleProps {
  title: string;
  subtitle?: string;
}

export default function Title({ title, subtitle }: TitleProps) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-3xl font-bold">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
