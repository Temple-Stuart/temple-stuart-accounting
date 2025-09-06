import HeroSection from '@/components/sections/HeroSection';
import BookkeepingSection from '@/components/sections/BookkeepingSection';
import LoginSection from '@/components/sections/LoginSection';

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <BookkeepingSection />
      <LoginSection />
    </main>
  );
}
