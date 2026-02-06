import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Temple Stuart',
  description: 'Privacy Policy for Temple Stuart',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-light text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 5, 2026</p>
        
        <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
          <p>Temple Stuart LLC ("we", "us", "our") operates www.templestuart.com. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">1. Information We Collect</h2>
          
          <h3 className="text-md font-medium text-gray-800 mt-4">Information You Provide</h3>
          <p>When you create an account, we collect your name, email address, and password. When you use our budgeting features, we store the financial data you manually enter, including expenses, budgets, and trip plans.</p>

          <h3 className="text-md font-medium text-gray-800 mt-4">Information from Plaid (Pro and Pro+ Users)</h3>
          <p>If you connect your bank accounts through Plaid, we receive your account balances, transaction history, and account identifiers. We do not receive or store your bank login credentials — those are handled securely by Plaid. Please review Plaid's Privacy Policy at https://plaid.com/legal/#end-user-privacy-policy.</p>

          <h3 className="text-md font-medium text-gray-800 mt-4">Payment Information</h3>
          <p>Subscription payments are processed by Stripe. We do not store your full credit card number. Stripe may share with us your card's last four digits, expiration date, and billing address for record-keeping purposes.</p>

          <h3 className="text-md font-medium text-gray-800 mt-4">Automatically Collected Information</h3>
          <p>We use cookies to maintain your login session. We may collect basic usage analytics to improve our service. We do not use tracking cookies for advertising purposes.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">2. How We Use Your Information</h2>
          <p>We use your information to: (a) provide and maintain the service; (b) process your transactions and subscriptions; (c) communicate with you about your account; (d) improve our service; and (e) comply with legal obligations.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">3. Data Storage and Security</h2>
          <p>Your data is stored on Microsoft Azure servers with encryption at rest and in transit. We implement industry-standard security measures including authenticated API routes, isolated user sessions, and secure password hashing. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">4. Data Sharing</h2>
          <p>We do not sell your personal information. We share data only with: (a) Plaid, to facilitate bank connections; (b) Stripe, to process payments; (c) service providers who assist in operating our service, under confidentiality agreements; and (d) as required by law or to protect our rights.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">5. AI Features (Pro+ Users)</h2>
          <p>If you use AI-powered features, your prompts and relevant financial data may be sent to third-party AI providers (such as OpenAI) to generate responses. We minimize the data shared and do not send your bank credentials or full account numbers.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">6. Data Retention</h2>
          <p>We retain your data for as long as your account is active or as needed to provide services. If you delete your account, we will delete your personal data within 30 days, except where retention is required by law.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">7. Your Rights</h2>
          <p>Depending on your location, you may have the right to: (a) access your personal data; (b) correct inaccurate data; (c) delete your data; (d) export your data; and (e) opt out of certain data processing. To exercise these rights, contact us at astuart@templestuart.com.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">8. California Privacy Rights</h2>
          <p>California residents have additional rights under the CCPA, including the right to know what personal information is collected and the right to request deletion. We do not sell personal information as defined by the CCPA.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">9. Children's Privacy</h2>
          <p>Our service is not intended for users under 18 years of age. We do not knowingly collect personal information from children under 18.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">10. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or through the service. Your continued use after changes constitutes acceptance.</p>

          <h2 className="text-lg font-medium text-gray-900 mt-8">11. Contact Us</h2>
          <p>If you have questions about this Privacy Policy or our data practices, contact us at astuart@templestuart.com.</p>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <a href="/" className="text-sm text-[#2d1b4e] hover:underline">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}
