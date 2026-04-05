import { Moon, Sun, Star, Ship, Monitor, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const themes = [
  {
    value: 'light',
    label: 'Claro',
    icon: Sun,
    colors: ['#ffffff', '#1e293b', '#3b82f6'],
  },
  {
    value: 'dark',
    label: 'Oscuro',
    icon: Moon,
    colors: ['#0f172a', '#e2e8f0', '#3b82f6'],
  },
  {
    value: 'midnight',
    label: 'Midnight',
    icon: Star,
    colors: ['#0c0e1a', '#c5c8d6', '#7c5cf7'],
  },
  {
    value: 'logistics-blue',
    label: 'Logistics Blue',
    icon: Ship,
    colors: ['#111d2b', '#d4e0e8', '#2bbcc4'],
  },
  {
    value: 'system',
    label: 'Sistema',
    icon: Monitor,
    colors: [],
  },
];

function ActiveIcon({ theme }: { theme: string | undefined }) {
  const match = themes.find((t) => t.value === theme);
  const Icon = match?.icon ?? Monitor;
  return <Icon className="h-5 w-5" />;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ActiveIcon theme={theme} />
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {themes.map((t) => {
          const Icon = t.icon;
          const isActive = theme === t.value;
          return (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {t.colors.length > 0 && (
                  <div className="flex gap-0.5">
                    {t.colors.map((color, i) => (
                      <span
                        key={i}
                        className="inline-block w-3 h-3 rounded-full border border-border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}
                {isActive && <Check className="h-4 w-4 text-primary" />}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
