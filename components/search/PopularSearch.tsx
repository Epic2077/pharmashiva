import { Badge } from "../ui/badge";

export default function PopularSearch() {
  const popularSearches = [
    "Vitamin D",
    "Omega-3",
    "Probiotic",
    "Magnesium",
    "Collagen",
    "Zinc",
  ];
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">Popular Searches</h3>
      <div className="flex flex-wrap gap-3 ">
        {popularSearches.map((search) => (
          <Badge
            key={search}
            variant="secondary"
            className="cursor-pointer py-4.5 px-4"
          >
            {search}
          </Badge>
        ))}
      </div>
    </div>
  );
}
