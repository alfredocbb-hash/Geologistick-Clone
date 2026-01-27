import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

interface LegalPageLayoutProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 md:py-24">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">{title}</h1>
            {lastUpdated && (
              <p className="text-muted-foreground text-sm">
                Última actualización: {lastUpdated}
              </p>
            )}
          </div>
          <div className="prose prose-invert max-w-none space-y-8">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
