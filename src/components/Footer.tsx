export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="text-sm text-gray-600">
            © {new Date().getFullYear()} Temple Stuart Accounting. All rights reserved.
          </div>
          <div className="mt-4 sm:mt-0">
            <a 
              href="/developer" 
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Developer Access
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
