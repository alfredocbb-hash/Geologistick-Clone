import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Building2, Package, Users } from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

function CountUpItem({ icon: Icon, value, label, suffix }: { icon: LucideIcon; value: number; label: string; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (value === 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / 2000, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * value));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="text-center group">
      <div className="h-16 w-16 rounded-2xl bg-[hsl(var(--geo-teal)/0.08)] flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
        <Icon className="h-8 w-8 text-[hsl(var(--geo-teal))]" />
      </div>
      <div className="text-4xl lg:text-5xl font-bold text-foreground dark:text-white mb-2">
        {count.toLocaleString()}{suffix}
      </div>
      <p className="text-sm text-muted-foreground dark:text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
  );
}

const StatsCounter = () => {
  const { t } = useTranslation('landing');

  const { data: tenantCount } = useQuery({
    queryKey: ['public-stats-tenants'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_public_active_tenant_count');
      return data || 0;
    },
    staleTime: 1000 * 60 * 30,
  });

  const stats = [
    { icon: Building2, value: tenantCount || 10, label: t('stats.activeCompanies'), suffix: "+" },
    { icon: Package, value: 50000, label: t('stats.shipmentsManaged'), suffix: "+" },
    { icon: Users, value: 200, label: t('stats.driversConnected'), suffix: "+" },
    { icon: Truck, value: 99, label: t('stats.uptimeGuaranteed'), suffix: "%" },
  ];

  return (
    <section className="relative py-20 overflow-hidden bg-background dark:bg-[#050507]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {stats.map((stat, i) => (
            <CountUpItem key={i} icon={stat.icon} value={stat.value} label={stat.label} suffix={stat.suffix} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsCounter;
