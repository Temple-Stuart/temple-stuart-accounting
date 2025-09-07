import HeroSection from '@/components/sections/HeroSection';
import BookkeepingSection from '@/components/sections/BookkeepingSection';
import ClientPortalSection from '@/components/sections/ClientPortalSection';

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <BookkeepingSection />
      <ClientPortalSection />
    </main>
  );
}
