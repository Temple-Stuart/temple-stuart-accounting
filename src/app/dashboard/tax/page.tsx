import { redirect } from 'next/navigation';

// DEPRECATED: /dashboard/tax has been replaced by the tax filing wizard at
// /dashboard/tax-filing. This route is kept for backwards compatibility —
// anyone with the old URL bookmarked will be seamlessly redirected.
export default function TaxPage() {
  redirect('/dashboard/tax-filing');
}
