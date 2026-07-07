import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'reactjs-platform/ui';
import { PAGE_SIZE_OPTIONS, type PageSizeOption } from './config';

interface PageSizeSelectorProps {
  value: number;
  onChange: (pageSize: PageSizeOption) => void;
  disabled?: boolean;
  options?: readonly number[];
}

export function PageSizeSelector({
  value,
  onChange,
  disabled = false,
  options = PAGE_SIZE_OPTIONS,
}: PageSizeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Rows per page:</span>
      <Select
        value={value.toString()}
        onValueChange={(newValue) => onChange(Number(newValue) as PageSizeOption)}
        disabled={disabled}>
        <SelectTrigger className="w-20 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((size) => (
            <SelectItem key={size} value={size.toString()}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
