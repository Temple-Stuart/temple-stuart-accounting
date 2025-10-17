import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/components/sections/HeroSection';
import AsSeenInSection from '@/components/sections/AsSeenInSection';
import ProspectSection from '@/components/sections/ProspectSection';
import OpenSourceSection from '@/components/sections/OpenSourceSection';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <AsSeenInSection />
        <ProspectSection />
        <OpenSourceSection />
      </main>
      <Footer />
    </>
  );
}
