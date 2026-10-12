import CategoriesCard from "./CategoriesCard";

export default function CategoriesSearch() {
  const categories = [
    {
      image: "/images/categories/1.png",
      title: "Vitamins",
      count: 142,
    },
    {
      image: "/images/categories/2.png",
      title: "Pain Relief",
      count: 89,
    },
    {
      image: "/images/categories/3.png",
      title: "Minerals",
      count: 56,
    },
    {
      image: "/images/categories/4.png",
      title: "Herbal Supplements",
      count: 73,
    },
    {
      image: "/images/categories/5.png",
      title: "Digestive Health",
      count: 42,
    },
    {
      image: "/images/categories/6.png",
      title: "Immune Support",
      count: 67,
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">Categories</h3>
      {categories.map((category) => (
        <CategoriesCard
          key={category.title}
          image={category.image}
          title={category.title}
          count={category.count}
          href={`/categories/${category.title.toLowerCase().replace(/ /g, "-")}`}
        />
      ))}
    </div>
  );
}
