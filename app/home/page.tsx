import HomeHeader from "@/components/home/Header";

export default function HomePage() {
  return (
    <div className="min-w-screen min-h-screen " dir="ltr">
      <HomeHeader isLoggedIn={false} user={() => {}} />
    </div>
  );
}
