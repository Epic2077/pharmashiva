import CategoriesSearch from "@/components/search/CategoriesSearch";
import PopularSearch from "@/components/search/PopularSearch";
import SearchBar from "@/components/search/SearchBar";
import Title from "@/components/shared/Title";

export default function SearchPage() {
  return (
    <div className="flex flex-col gap-8 pt-2">
      <Title
        title="Search Products"
        subtitle="Find medicines & supplements"
        profile
      />
      <SearchBar />
      <PopularSearch />
      <CategoriesSearch />
    </div>
  );
}
