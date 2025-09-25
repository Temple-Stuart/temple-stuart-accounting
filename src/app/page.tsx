import Header from '@/components/Header';
import Footer from '@/components/Footer';import HeroSection from '@/components/sections/HeroSection';
import ProspectSection from '@/components/sections/ProspectSection';
import ClientPortalSection from '@/components/sections/ClientPortalSection';

export default function Home() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Header />
      <main>
        <HeroSection />
        <ProspectSection />
        <ClientPortalSection />
      </main>
      <Footer />
    </div>
  );
}
