import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

/**
 * Formats a phone number for Argentina WhatsApp:
 * - Strips spaces, dashes, dots, parentheses
 * - Removes leading 0 from area code (011→11)
 * - Converts mobile prefix 15→9
 * - Prepends +54 if not already present
 */
export function formatArgentinaPhone(phone: string): string {
  if (!phone) return '';
  
  // Strip non-digits except leading +
  let cleaned = phone.replace(/[^0-9+]/g, '');
  
  // If already starts with +54, normalize from there
  if (cleaned.startsWith('+54')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('54')) {
    cleaned = cleaned.slice(2);
  }
  
  // Remove leading 0 (area code prefix)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  
  // Convert 15 prefix to 9 (mobile)
  // Match patterns like 11 15 xxxx or just 15 xxxx after area code
  if (cleaned.length >= 10) {
    // Check if there's a 15 after the area code (2-4 digits)
    const areaCodeMatch = cleaned.match(/^(\d{2,4})(15)(\d{4,})$/);
    if (areaCodeMatch) {
      cleaned = areaCodeMatch[1] + '9' + areaCodeMatch[3];
    }
  } else if (cleaned.startsWith('15')) {
    cleaned = '9' + cleaned.slice(2);
  }
  
  // Prepend +54
  return '+54' + cleaned;
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.length >= 10;
}

// WhatsApp SVG icon
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-[hsl(142,70%,45%)]">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, id, placeholder = 'Ej: 11 1234-5678', required, className, disabled }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const valid = isValidPhone(value);

    const handleBlur = () => {
      setIsFocused(false);
      if (value && value.trim().length > 0) {
        const formatted = formatArgentinaPhone(value);
        if (formatted !== value) {
          onChange(formatted);
        }
      }
    };

    return (
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <WhatsAppIcon />
        </div>
        <input
          ref={ref}
          id={id}
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-9 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            className,
          )}
        />
        {valid && !isFocused && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <CheckCircle2 className="h-4 w-4 text-[hsl(142,70%,45%)]" />
          </div>
        )}
      </div>
    );
  },
);

PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
