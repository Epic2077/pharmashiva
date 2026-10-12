import { ChevronRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface CategoriesCardProps {
  image: string;
  title: string;
  count: number;
  href: string;
}

export default function CategoriesCard({
  image,
  title,
  count,
  href,
}: CategoriesCardProps) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-b w-full h-16 py-4"
    >
      <div className="flex gap-4">
        <div className="bg-secondary w-10 h-10 rounded-lg flex items-center justify-center">
          <Image
            src={image}
            alt={title}
            width={40}
            height={40}
            className="rounded-lg"
          />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{count} Products</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ChevronRightIcon className="text-sm text-muted-foreground" />
      </div>
    </Link>
  );
}
