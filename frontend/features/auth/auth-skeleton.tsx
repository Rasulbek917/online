export function AuthSkeleton() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-11 w-11 rounded-2xl" />
      <div className="space-y-2">
        <div className="skeleton h-7 w-1/2" />
        <div className="skeleton h-4 w-4/5" />
      </div>
      <div className="space-y-4">
        <div className="skeleton h-10 w-full rounded-xl" />
        <div className="skeleton h-10 w-full rounded-xl" />
        <div className="skeleton h-12 w-full rounded-xl" />
      </div>
      <div className="skeleton h-11 w-full rounded-xl" />
    </div>
  );
}
