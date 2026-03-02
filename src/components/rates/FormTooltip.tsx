import { HelpCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FormTooltipProps {
  label: string;
  tooltip: string;
  required?: boolean;
  htmlFor?: string;
}

export function FormTooltip({ label, tooltip, required, htmlFor }: FormTooltipProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger type="button" className="text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-xs">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
