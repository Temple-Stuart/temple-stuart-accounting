export default function PressSection() {
  return (
    <section className="py-16 bg-white border-t border-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Header */}
        <p className="text-[10px] font-normal text-gray-400 tracking-[0.2em] mb-6">
          FEATURED IN
        </p>
        
        {/* Publications */}
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          <a 
            href="https://www.nytimes.com/2025/09/13/business/chatgpt-financial-advice.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="font-serif text-lg sm:text-xl italic">
              The New York Times
            </span>
          </a>
          
          <span className="text-gray-300">•</span>
          
          <a 
            href="https://www.straitstimes.com/business/they-had-money-problems-they-turned-to-chatgpt-for-solutions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="font-serif text-lg sm:text-xl italic">
              The Straits Times
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
