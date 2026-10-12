import CategoriesSearch from "@/components/search/CategoriesSearch";
import PopularSearch from "@/components/search/PopularSearch";
import SearchBar from "@/components/search/SearchBar";
import Title from "@/components/shared/Title";

export default function SearchPage() {
  return (
    <div className="min-h-screen flex flex-col gap-8 mt-2">
      <Title title="Search Products" />
      <SearchBar />
      <PopularSearch />
      <CategoriesSearch />
    </div>
  );
}
