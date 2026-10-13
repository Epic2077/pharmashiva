import ProfileNav from "./ProfileNav";

interface TitleProps {
  title: string;
  subtitle?: string;
  profile?: boolean;
}

export default function Title({ title, subtitle, profile }: TitleProps) {
  const isLoggedIn = true;
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {profile && <ProfileNav isLoggedIn={isLoggedIn} />}
    </div>
  );
}
