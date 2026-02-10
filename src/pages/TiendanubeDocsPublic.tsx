import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { HOMOLOGACION_CONTENT } from '@/lib/generateHomologacionPDF';
import { FAQ_CONTENT } from '@/lib/generateFAQsHomologacionPDF';
import { DIAGRAM_ACTORS, DIAGRAM_FLOWS } from '@/lib/tiendanubeDocsData';
import { FileText, GitBranch, HelpCircle, ArrowRight, Shield, Users } from 'lucide-react';
import logoImg from '@/assets/geologistick-logo.png';

const TN_BLUE = 'hsl(216, 52%, 39%)';

function SectionContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed === '') {
      elements.push(<div key={i} className="h-2" />);
      return;
    }

    const isBullet = trimmed.startsWith('•');
    const isUrl = trimmed.includes('https://') || trimmed.includes('{SUPABASE_URL}');
    const isSubHeader = !isBullet && !isUrl && !trimmed.startsWith(' ') &&
      !/^\d\./.test(trimmed) && trimmed.length < 60;

    if (isBullet) {
      elements.push(
        <p key={i} className="text-sm text-muted-foreground pl-4 py-0.5">{trimmed}</p>
      );
    } else if (isUrl) {
      elements.push(
        <code key={i} className="block text-xs bg-muted px-3 py-1.5 rounded font-mono text-muted-foreground my-1">
          {trimmed}
        </code>
      );
    } else if (isSubHeader) {
      elements.push(
        <h4 key={i} className="font-semibold text-sm mt-4 mb-1" style={{ color: TN_BLUE }}>
          {trimmed}
        </h4>
      );
    } else {
      elements.push(
        <p key={i} className="text-sm text-muted-foreground leading-relaxed">{trimmed}</p>
      );
    }
  });

  return <div>{elements}</div>;
}

function HomologacionTab() {
  return (
    <div className="space-y-6">
      {HOMOLOGACION_CONTENT.sections.map((section, idx) => (
        <Card key={idx} className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold" style={{ color: TN_BLUE }}>
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SectionContent content={section.content} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DiagramasTab() {
  return (
    <div className="space-y-6">
      {/* Actors */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2" style={{ color: TN_BLUE }}>
            <Users className="h-4 w-4" /> Actores del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {DIAGRAM_ACTORS.map((actor, i) => (
            <div key={i} className="bg-muted/50 rounded-lg p-3 border border-border/30">
              <p className="font-semibold text-sm" style={{ color: TN_BLUE }}>{actor.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{actor.desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Flows */}
      {DIAGRAM_FLOWS.map((flow, fIdx) => (
        <Card key={fIdx} className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold" style={{ color: TN_BLUE }}>
              {flow.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {flow.steps.map((step, sIdx) => (
              <div key={sIdx} className="flex items-start gap-2 py-1.5 border-b border-border/20 last:border-0">
                <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 font-mono" style={{ borderColor: TN_BLUE, color: TN_BLUE }}>
                  {sIdx + 1}
                </Badge>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold flex-wrap">
                    <span style={{ color: TN_BLUE }}>{step.from}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span style={{ color: TN_BLUE }}>{step.to}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
            {flow.note && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 mt-3">
                <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                  📌 {flow.note}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FAQsTab() {
  return (
    <div className="space-y-6">
      {FAQ_CONTENT.map((category, cIdx) => (
        <Card key={cIdx} className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold" style={{ color: TN_BLUE }}>
                {cIdx + 1}. {category.title}
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                {category.faqs.length} preguntas
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {category.faqs.map((faq, fIdx) => (
              <div key={fIdx}>
                <p className="text-sm font-semibold mb-1" style={{ color: TN_BLUE }}>
                  P{fIdx + 1}: {faq.question}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </p>
                {fIdx < category.faqs.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function TiendanubeDocsPublic() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
          <div className="flex items-center gap-4">
            <img src={logoImg} alt="Geologistick" className="h-12 w-auto" />
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: TN_BLUE }}>
                Geologistick
              </h1>
              <p className="text-sm text-muted-foreground">
                Documentacion de Homologacion — Tiendanube Argentina
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="secondary" className="text-[10px]">
              <Shield className="h-3 w-3 mr-1" /> OAuth 2.0
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              HMAC-SHA256
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              GDPR Compliant
            </Badge>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        <Tabs defaultValue="homologacion" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-6">
            <TabsTrigger value="homologacion" className="text-xs sm:text-sm gap-1.5">
              <FileText className="h-4 w-4 hidden sm:block" />
              Homologacion
            </TabsTrigger>
            <TabsTrigger value="diagramas" className="text-xs sm:text-sm gap-1.5">
              <GitBranch className="h-4 w-4 hidden sm:block" />
              Diagramas
            </TabsTrigger>
            <TabsTrigger value="faqs" className="text-xs sm:text-sm gap-1.5">
              <HelpCircle className="h-4 w-4 hidden sm:block" />
              FAQs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="homologacion">
            <HomologacionTab />
          </TabsContent>
          <TabsContent value="diagramas">
            <DiagramasTab />
          </TabsContent>
          <TabsContent value="faqs">
            <FAQsTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 text-center">
          <p className="text-xs text-muted-foreground">
            Geologistick — Sistema de Gestion Logistica — {new Date().getFullYear()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Contacto: alfredocbb@gmail.com
          </p>
        </div>
      </footer>
    </div>
  );
}
