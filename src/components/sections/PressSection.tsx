export default function PressSection() {
  return (
    <section className="py-16 bg-white border-t border-border-light">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Header */}
        <p className="text-[10px] font-normal text-text-faint tracking-[0.2em] mb-6">
          FEATURED IN
        </p>
        
        {/* Publications */}
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          <a 
            href="https://www.nytimes.com/2025/09/13/business/chatgpt-financial-advice.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-faint hover:text-text-secondary transition-colors"
          >
            <span className="font-serif text-terminal-lg sm:text-sm italic">
              The New York Times
            </span>
          </a>
          
          <span className="text-text-faint">•</span>
          
          <a 
            href="https://www.straitstimes.com/business/they-had-money-problems-they-turned-to-chatgpt-for-solutions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-faint hover:text-text-secondary transition-colors"
          >
            <span className="font-serif text-terminal-lg sm:text-sm italic">
              The Straits Times
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
