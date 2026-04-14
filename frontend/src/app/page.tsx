export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Sitepilot</h1>
      <p className="text-lg text-gray-600">
        SaaS platform for website automation, SEO and AI tools
      </p>
      <a
        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/docs`}
        className="mt-8 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        target="_blank"
        rel="noopener noreferrer"
      >
        API Documentation
      </a>
    </main>
  );
}
