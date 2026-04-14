import { Package, ScanLine, UserCheck, Route, CheckCircle2, Calculator } from "lucide-react";
import { useTranslation } from "react-i18next";

const stepIcons = [Package, ScanLine, UserCheck, Route, CheckCircle2, Calculator];

const Circuito = () => {
  const { t } = useTranslation('landing');

  const steps = stepIcons.map((icon, i) => ({
    icon,
    label: t(`circuit.s${i + 1}Label`),
    desc: t(`circuit.s${i + 1}Desc`),
  }));

  return (
    <section id="circuit" className="relative py-28 overflow-hidden bg-muted dark:bg-[#050507]">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground dark:text-white mb-6 tracking-tight">
            {t('circuit.title')}
            <span className="bg-gradient-to-r from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-cyan))] bg-clip-text text-transparent">{t('circuit.titleHighlight')}</span>
          </h2>
          <p className="text-lg text-muted-foreground dark:text-gray-400">
            {t('circuit.subtitle')}
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="hidden lg:flex items-start justify-between relative">
            <div className="absolute top-10 left-[8%] right-[8%] h-0.5 bg-gradient-to-r from-[hsl(var(--geo-teal)/0.3)] via-[hsl(var(--geo-cyan)/0.3)] to-[hsl(var(--geo-blue)/0.3)]" />
            {steps.map((step, i) => (
              <div key={i} className="relative flex flex-col items-center text-center w-1/6 group">
                <div className="relative z-10 h-20 w-20 rounded-2xl bg-card dark:bg-white/[0.03] border-2 border-[hsl(var(--geo-teal)/0.2)] flex items-center justify-center mb-5 group-hover:border-[hsl(var(--geo-teal))] group-hover:scale-110 transition-all duration-300 shadow-lg">
                  <step.icon className="h-9 w-9 text-[hsl(var(--geo-teal))]" />
                </div>
                <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-[hsl(var(--geo-teal))] text-white text-xs font-bold mb-3">
                  {i + 1}
                </span>
                <h4 className="font-semibold text-foreground dark:text-white mb-2">{step.label}</h4>
                <p className="text-sm text-muted-foreground dark:text-gray-500 leading-relaxed px-2">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="lg:hidden space-y-6">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-5 items-start group">
                <div className="flex flex-col items-center">
                  <div className="h-14 w-14 rounded-xl bg-card dark:bg-white/[0.03] border-2 border-[hsl(var(--geo-teal)/0.2)] flex items-center justify-center group-hover:border-[hsl(var(--geo-teal))] transition-colors shrink-0">
                    <step.icon className="h-7 w-7 text-[hsl(var(--geo-teal))]" />
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-0.5 h-6 bg-[hsl(var(--geo-teal)/0.2)] mt-2" />
                  )}
                </div>
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[hsl(var(--geo-teal))] text-white text-xs font-bold">{i + 1}</span>
                    <h4 className="font-semibold text-foreground dark:text-white">{step.label}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground dark:text-gray-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Circuito;
