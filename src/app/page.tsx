import Header from '@/components/navigation/Header';
import HeroSection from '@/components/sections/HeroSection';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="py-12">
        <HeroSection />
      </main>
    </div>
  );
}
