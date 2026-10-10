import HistoryFilters from "@/components/history/HistoryFilters";
import HistoryHeader from "@/components/history/HistoryHeader";
import HistorySection from "@/components/history/HistorySection";

export default function HistoryPage() {
  return (
    <div className="flex flex-col gap-8">
      <HistoryHeader />
      <HistoryFilters />
      <HistorySection />
    </div>
  );
}
