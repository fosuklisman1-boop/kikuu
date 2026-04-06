export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Image skeleton */}
        <div className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />

        {/* Details skeleton */}
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
          <div className="h-8 bg-gray-200 rounded w-3/4 animate-pulse" />
          <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse" />
          <div className="space-y-2 pt-4">
            <div className="h-3 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 bg-gray-100 rounded w-4/5 animate-pulse" />
          </div>
          <div className="h-12 bg-gray-200 rounded-xl animate-pulse mt-6" />
        </div>
      </div>
    </div>
  )
}
