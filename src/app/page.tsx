import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/components/sections/HeroSection';
import ModulesSection from '@/components/sections/ModulesSection';
import PressSection from '@/components/sections/PressSection';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <ModulesSection />
        <PressSection />
      </main>
      <Footer />
    </>
  );
}
