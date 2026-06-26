export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <p className="text-xs text-[#9a9589]">Loading...</p>
      </div>
    </div>
  )
}
