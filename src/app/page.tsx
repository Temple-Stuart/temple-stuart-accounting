import Header from '@/components/navigation/Header';
import HeroSection from '@/components/sections/HeroSection';
import BookkeepingSection from '@/components/sections/BookkeepingSection';
import DataIntegrationsSection from '@/components/sections/DataIntegrationsSection';
import ClientPortal from '@/components/sections/ClientPortal';
import ContactForm from '@/components/forms/ContactForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="py-12">
        <HeroSection />
        <BookkeepingSection />
        <DataIntegrationsSection />
        <ClientPortal />
        <ContactForm />
      </main>
    </div>
  );
}
