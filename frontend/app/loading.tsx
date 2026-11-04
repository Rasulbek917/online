export default function Loading() {
  return (
    <div className="container py-12">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton mt-6 h-10 w-2/3 max-w-xl" />
      <div className="skeleton mt-3 h-4 w-full max-w-2xl" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="surface overflow-hidden">
            <div className="skeleton aspect-[16/10] rounded-none" />
            <div className="space-y-3 p-5">
              <div className="skeleton h-4 w-4/5" />
              <div className="skeleton h-3 w-2/5" />
              <div className="skeleton h-6 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
