import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * Normalize an Argentine phone number for WhatsApp.
 * - Strips non-digits (except leading +)
 * - Removes leading 0 (area code prefix)
 * - Converts "15" mobile prefix → "9" (WhatsApp format)
 * - Ensures +54 country code
 */
export function formatArgentinaPhone(raw: string): string {
  if (!raw) return "";

  // Keep only digits
  let cleaned = raw.replace(/\D/g, "");

  // If too few digits, don't normalize — return as-is to avoid legitimizing garbage input
  if (cleaned.length < 6) {
    return raw;
  }

  // Remove leading 0 (e.g. 011… → 11…)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // Convert "15" mobile prefix to "9" for WhatsApp international format
  // e.g. 11 15 1234-5678 → already handled as 1115… → 11 9…
  // But standalone 15XXXX (without area code) → 9XXXX
  if (cleaned.startsWith("15") && cleaned.length <= 10) {
    cleaned = "9" + cleaned.substring(2);
  }

  // If it already starts with 54, don't double-add
  if (cleaned.startsWith("54")) {
    return `+${cleaned}`;
  }

  return `+54${cleaned}`;
}

function isValidArgentinePhone(value: string): boolean {
  if (!value) return false;
  const digits = value.replace(/\D/g, "");
  // A valid Argentine number has 10-13 digits (with or without country code)
  return digits.length >= 10;
}

interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value, onChange, onBlur, ...props }, ref) => {
    const isValid = isValidArgentinePhone(value);

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (value && value.trim()) {
        const formatted = formatArgentinaPhone(value);
        onChange(formatted);
      }
      onBlur?.(e);
    };

    return (
      <div className="relative">
        <div className="absolute left-0 top-0 h-full flex items-center pl-2 pointer-events-none">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-green-500" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
          </svg>
        </div>
        <input
          ref={ref}
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          className={cn(
            "flex h-8 w-full rounded-md border border-input bg-background pl-7 pr-7 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          placeholder="+54 11 1234-5678"
          {...props}
        />
        {isValid && (
          <div className="absolute right-0 top-0 h-full flex items-center pr-2 pointer-events-none">
            <Check className="h-3 w-3 text-green-500" />
          </div>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
