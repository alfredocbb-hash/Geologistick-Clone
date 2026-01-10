import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { useGoogleMapsLoaded } from './GoogleMapsProvider';

export interface AddressDetails {
  address: string;
  city: string;
  province: string;
  postalCode: string;
  lat: number;
  lng: number;
  formattedAddress: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (details: AddressDetails) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Ingrese una dirección...',
  label,
  required = false,
  disabled = false,
  id,
  className = '',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const isGoogleMapsLoaded = useGoogleMapsLoaded();
  const [isInitializing, setIsInitializing] = useState(false);

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places || autocompleteRef.current) {
      return;
    }

    setIsInitializing(true);

    try {
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'ar' },
        fields: ['address_components', 'formatted_address', 'geometry', 'name'],
        types: ['address'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();

        if (!place.geometry?.location) {
          console.warn('No location data for selected place');
          return;
        }

        // Extract address components
        let streetNumber = '';
        let route = '';
        let city = '';
        let province = '';
        let postalCode = '';

        for (const component of place.address_components || []) {
          const types = component.types;

          if (types.includes('street_number')) {
            streetNumber = component.long_name;
          }
          if (types.includes('route')) {
            route = component.long_name;
          }
          if (types.includes('locality')) {
            city = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            province = component.long_name;
          }
          if (types.includes('postal_code')) {
            postalCode = component.long_name;
          }
        }

        const streetAddress = route ? `${route} ${streetNumber}`.trim() : (place.name || '');

        const details: AddressDetails = {
          address: streetAddress,
          city,
          province,
          postalCode,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          formattedAddress: place.formatted_address || '',
        };

        // Update input value
        onChange(streetAddress);
        
        // Notify parent
        onSelect(details);
      });

      autocompleteRef.current = autocomplete;
    } catch (error) {
      console.error('Error initializing autocomplete:', error);
    } finally {
      setIsInitializing(false);
    }
  }, [onChange, onSelect]);

  useEffect(() => {
    if (isGoogleMapsLoaded) {
      // Small delay to ensure DOM is ready
      const timeout = setTimeout(initAutocomplete, 100);
      return () => clearTimeout(timeout);
    }
  }, [isGoogleMapsLoaded, initAutocomplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label htmlFor={id}>
          {label} {required && '*'}
        </Label>
      )}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled || isInitializing}
          className="pl-10 pr-10"
        />
        {isInitializing && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>
      {!isGoogleMapsLoaded && (
        <p className="text-xs text-muted-foreground">
          Cargando autocompletado...
        </p>
      )}
    </div>
  );
}

export default AddressAutocomplete;
