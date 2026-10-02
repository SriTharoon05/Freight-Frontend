'use client';

export default function WorkspaceError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e8e9f6] p-4">
      <div role="alert" className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg">
        <h1 className="text-lg font-semibold text-[#171725]">Could not open this page</h1>
        <p className="mt-2 text-sm text-slate-600">Please try again. Your saved work is still available.</p>
        <button onClick={retry} className="mt-5 rounded-xl bg-[#7068cf] px-5 py-2 text-sm font-semibold text-white">Try again</button>
      </div>
    </main>
  );
}
