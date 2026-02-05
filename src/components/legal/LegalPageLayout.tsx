import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

interface LegalPageLayoutProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-[#050507] flex flex-col relative">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-0 left-1/4 w-[600px] h-[400px] rounded-full blur-[150px] opacity-50"
          style={{ 
            background: 'radial-gradient(ellipse, hsl(174 50% 50% / 0.08) 0%, transparent 70%)'
          }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[300px] rounded-full blur-[120px] opacity-40"
          style={{ 
            background: 'radial-gradient(ellipse, hsl(199 89% 48% / 0.06) 0%, transparent 70%)'
          }}
        />
      </div>
      
      <Navbar />
      
      <main className="flex-1 py-16 md:py-24 relative z-10">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{title}</h1>
            {lastUpdated && (
              <p className="text-gray-400 text-sm">
                Última actualización: {lastUpdated}
              </p>
            )}
          </div>
          <div className="prose prose-invert max-w-none space-y-8 
            prose-headings:text-white 
            prose-p:text-gray-400 
            prose-li:text-gray-400
            prose-strong:text-white
            prose-a:text-[hsl(174_100%_42%)] prose-a:no-underline hover:prose-a:underline
          ">
            {children}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
