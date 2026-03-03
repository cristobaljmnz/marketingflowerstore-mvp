import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">flowerstore.ph</h1>
      <p className="text-gray-500">Agent-Driven Marketing Automation</p>
      <nav className="flex gap-4">
        <Link href="/generate" className="underline">Generate</Link>
        <Link href="/library" className="underline">Library</Link>
        <Link href="/gallery" className="underline">Gallery</Link>
      </nav>
    </main>
  );
}
