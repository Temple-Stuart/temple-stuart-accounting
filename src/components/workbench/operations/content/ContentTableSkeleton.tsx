/**
 * ContentTableSkeleton — shimmer placeholder for the Content tab loading
 * state. Mirrors ContentTable's 14-column structure with animate-pulse
 * blocks so the layout doesn't jump when the real data arrives.
 *
 * No props, no state — pure presentational. Sets the operations-surface
 * skeleton convention (no precedent existed prior to PR-Ops-4.9.3g).
 */

const COLUMN_COUNT = 14;
const ROW_COUNT = 4;

export default function ContentTableSkeleton() {
  return (
    <div className="text-xs font-mono overflow-x-auto" aria-busy="true" aria-label="Loading content">
      <table className="w-full">
        <thead>
          <tr className="text-text-faint uppercase tracking-wide">
            {Array.from({ length: COLUMN_COUNT }).map((_, i) => (
              <th key={i} className="text-left pb-1 px-2">
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROW_COUNT }).map((_, r) => (
            <tr key={r} className="border-t border-border-light">
              {Array.from({ length: COLUMN_COUNT }).map((_, c) => (
                <td key={c} className="py-1 px-2">
                  <div className="h-3 w-full bg-gray-200 rounded animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
