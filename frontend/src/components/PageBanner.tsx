// In components/PageBanner.tsx
import Link from 'next/link';

interface PageBannerProps {
  title: string;
  description?: string;
  backLink?: string;
  backLabel?: string;
}

export function PageBanner({ title, description, backLink, backLabel }: PageBannerProps) {
  return (
    <section className="py-8 px-4 bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-2">
          {backLink && (
            <Link href={backLink} className="text-gray-300 hover:text-white">
              ← {backLabel || 'Back'}
            </Link>
          )}
          <h1 className="text-4xl md:text-5xl font-bold">
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent">
              {title}
            </span>
          </h1>
        </div>
        {description && (
          <p className="text-xl text-gray-300 max-w-3xl">
            {description}
          </p>
        )}
      </div>
    </section>
  );
}