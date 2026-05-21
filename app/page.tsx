import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white p-8 rounded-2xl shadow max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-green-800">
          Euro Trade Plus
        </h1>

        <p className="mt-3 text-gray-600">
          Evidencija otkupa, prodaje i stanja paleta
        </p>

        <Link
          href="/login"
          className="inline-block mt-6 bg-green-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-900"
        >
          Prijavi se
        </Link>
      </div>
    </main>
  );
}