import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Temple Stuart',
  description: 'Terms of Service for Temple Stuart',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-light text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 5, 2026</p>
        
        <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
          <p>Welcome to Temple Stuart. By accessing or using our service at www.templestuart.com, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">1. Description of Service</h2>
          <p>Temple Stuart is a personal finance management platform that provides budgeting tools, expense tracking, trip planning, and optional bank account integration. We offer both free and paid subscription tiers with varying features.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">2. Account Registration</h2>
          <p>To use certain features, you must create an account. You agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">3. Subscription and Payments</h2>
          <p>Paid subscriptions are billed monthly through Stripe. You may cancel your subscription at any time through the billing portal. Cancellation takes effect at the end of your current billing period. We do not offer refunds for partial months.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">4. Bank Account Integration</h2>
          <p>Our bank integration is powered by Plaid Inc. By connecting your bank accounts, you authorize Plaid to access your financial data on your behalf. We do not store your bank login credentials. Please review Plaid's terms of service and privacy policy.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">5. Not Financial Advice</h2>
          <p>Temple Stuart is a tool for organizing and tracking your financial information. Nothing in our service constitutes financial, tax, legal, or investment advice. We are not a registered investment advisor, broker-dealer, or tax professional. You should consult qualified professionals for financial decisions.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">6. Accuracy of Information</h2>
          <p>While we strive to display accurate financial data, we cannot guarantee the accuracy, completeness, or timeliness of information synced from third-party sources. You are responsible for verifying all financial information before making decisions based on it.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">7. Acceptable Use</h2>
          <p>You agree not to: (a) use the service for any unlawful purpose; (b) attempt to gain unauthorized access to our systems; (c) interfere with the proper functioning of the service; (d) upload malicious code; (e) impersonate others; or (f) use the service to harm others.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">8. Intellectual Property</h2>
          <p>The Temple Stuart service, including its design, features, and content, is owned by Temple Stuart LLC. You retain ownership of your personal financial data. By using the service, you grant us a limited license to process your data solely to provide the service.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">9. Disclaimer of Warranties</h2>
          <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. YOUR USE OF THE SERVICE IS AT YOUR OWN RISK.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">10. Limitation of Liability</h2>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, TEMPLE STUART LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">11. Termination</h2>
          <p>We may suspend or terminate your access to the service at any time for any reason, including violation of these terms. You may delete your account at any time. Upon termination, your right to use the service ceases immediately.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">12. Changes to Terms</h2>
          <p>We may modify these terms at any time. We will notify users of material changes via email or through the service. Continued use after changes constitutes acceptance of the new terms.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">13. Governing Law</h2>
          <p>These terms are governed by the laws of the State of California, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Los Angeles County, California.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">14. Contact</h2>
          <p>For questions about these terms, contact us at astuart@templestuart.com.</p>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <a href="/" className="text-sm text-[#2d1b4e] hover:underline">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}
