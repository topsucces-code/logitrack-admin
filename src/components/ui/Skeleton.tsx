/**
 * Skeleton loading components for replacing full-page spinners.
 * Uses Tailwind animate-pulse with gray-200 backgrounds.
 */

/** A single pulsing block used as a building primitive. */
function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

/**
 * Stat card skeleton -- matches the Card layout used on Dashboard / Finances:
 *   left: title line + big number line + small subtitle line
 *   right: icon circle
 */
export function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between animate-pulse">
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-7 w-20" />
          <SkeletonBlock className="h-3.5 w-28" />
        </div>
        <div className="w-12 h-12 bg-gray-200 rounded-xl flex-shrink-0" />
      </div>
    </div>
  );
}

/**
 * Chart card skeleton -- matches the Card + CardHeader + chart area layout.
 * Shows a title bar placeholder and a rectangular chart area.
 */
export function SkeletonChartCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className}`}>
      <div className="animate-pulse">
        {/* Title placeholder */}
        <SkeletonBlock className="h-5 w-48 mb-4" />
        {/* Chart area */}
        <SkeletonBlock className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Table row skeleton -- a single row with N columns of varying widths.
 * @param columns Number of columns to render (default 6).
 */
export function SkeletonTableRow({ columns = 6 }: { columns?: number }) {
  // Varying widths so columns look natural
  const widths = ['w-20', 'w-28', 'w-24', 'w-20', 'w-24', 'w-24'];
  return (
    <tr className="border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <SkeletonBlock className={`h-4 ${widths[i % widths.length]}`} />
        </td>
      ))}
    </tr>
  );
}

/**
 * Full table skeleton with a header row and N body rows.
 */
export function SkeletonTable({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="animate-pulse">
        {/* Table title */}
        <SkeletonBlock className="h-5 w-56 mb-4" />
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                {Array.from({ length: columns }).map((_, i) => (
                  <th key={i} className="py-3 px-4 text-left">
                    <SkeletonBlock className="h-3.5 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, i) => (
                <SkeletonTableRow key={i} columns={columns} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * A generic small list-item skeleton (used for driver distribution, quick actions, etc.)
 */
export function SkeletonListItem() {
  return (
    <div className="flex items-center justify-between animate-pulse">
      <div className="flex items-center">
        <div className="w-3 h-3 bg-gray-200 rounded-full mr-3" />
        <SkeletonBlock className="h-4 w-28" />
      </div>
      <SkeletonBlock className="h-4 w-10" />
    </div>
  );
}
