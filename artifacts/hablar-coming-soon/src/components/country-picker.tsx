import { useRef, useState } from 'react';
import { defaultCountries, parseCountry } from 'react-international-phone';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import './country-picker.css';

export const phoneCountries = defaultCountries.map(parseCountry);

function countryFlag(iso2: string) {
  return [...iso2.toUpperCase()]
    .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + 127397))
    .join('');
}

export function CountryPicker({ value, onChange }: {
  value: string;
  onChange: (iso2: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = phoneCountries.find((country) => country.iso2 === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="phone-country-select"
          data-testid="button-country-picker"
          aria-label={`Country calling code: ${selected?.name}, +${selected?.dialCode}`}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span aria-hidden="true">{selected && countryFlag(selected.iso2)}</span>
          <span className="country-selection">{selected?.name} (+{selected?.dialCode})</span>
          <ChevronsUpDown size={14} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="country-popover"
        align="start"
        collisionPadding={12}
        aria-label="Choose a country calling code"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <Command
          label="Country calling codes"
          defaultValue={value}
          loop
          filter={(iso2, search) => {
            const country = phoneCountries.find((item) => item.iso2 === iso2);
            const query = search.trim().toLowerCase();
            return country && (
              country.name.toLowerCase().includes(query)
              || country.iso2.includes(query)
              || `+${country.dialCode}`.includes(query)
            ) ? 1 : 0;
          }}
        >
          <CommandInput
            ref={inputRef}
            aria-label="Search countries by name, ISO code or calling code"
            placeholder="Country, ISO code or +code"
            data-testid="input-country-search"
            autoComplete="off"
          />
          <CommandList aria-label="Countries" className="country-options">
            <CommandEmpty data-testid="status-country-empty">No countries found. Try a name or calling code.</CommandEmpty>
            {phoneCountries.map((country) => (
              <CommandItem
                key={country.iso2}
                value={country.iso2}
                className="country-option"
                data-testid={`option-country-${country.iso2}`}
                onSelect={() => {
                  onChange(country.iso2);
                  setOpen(false);
                }}
              >
                <span aria-hidden="true">{countryFlag(country.iso2)}</span>
                <span className="country-option-name">{country.name}</span>
                <span>+{country.dialCode}</span>
                {value === country.iso2 && <Check aria-label="Current country" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
