'use client';

import { cn } from 'reactjs-platform/utilities';
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { API } from 'reactjs-platform/utilities/api';

import { Button } from './button';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from './command';
import { Command as CommandPrimitive } from 'cmdk';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface SearchableSelectOption {
  value: string;
  label: string;

  [key: string]: any;
}

const DEFAULT_OPTIONS: SearchableSelectOption[] = [];

const normalizeSearchText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .trim()
    .toLowerCase();

export interface SearchableSelectProps {
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  inlineSearchTrigger?: boolean;
  persistSearchText?: boolean;
  fetchOnOpen?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onOptionSelect?: (option: SearchableSelectOption | null) => void;
  onSearchChange?: (search: string) => void;
  options?: SearchableSelectOption[];
  apiUrl?: string;
  apiFunction?: (params: any) => Promise<any[]>;
  loadByIdFunction?: (id: string) => Promise<SearchableSelectOption | null>;
  searchKey?: string;
  apiExtraParams?: Record<string, unknown>;
  apiPageSize?: number;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  clearable?: boolean;
  clearOnEmptySearch?: boolean;
  debounceMs?: number;
  minSearchLength?: number;
  maxHeight?: string;
  field?: {
    value: any;
    onChange: (value: any) => void;
    onBlur: () => void;
    name: string;
  };
}

const SearchableSelect = ({
  ref,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  inlineSearchTrigger = false,
  persistSearchText = false,
  fetchOnOpen = true,
  value,
  defaultValue,
  onValueChange,
  onOptionSelect,
  onSearchChange,
  options = DEFAULT_OPTIONS,
  apiUrl,
  apiFunction,
  loadByIdFunction,
  searchKey = 'search',
  apiExtraParams,
  apiPageSize = 100,
  disabled = false,
  loading: externalLoading = false,
  className,
  triggerClassName,
  contentClassName,
  clearable = false,
  clearOnEmptySearch = true,
  debounceMs = 300,
  minSearchLength = 0,
  maxHeight = '300px',
  field,
  ...props
}: SearchableSelectProps & { ref?: React.RefObject<React.ElementRef<typeof Button> | null> }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [internalLoading, setInternalLoading] = useState(false);
  const [selectedOptionLoading, setSelectedOptionLoading] = useState(false);
  const [apiOptions, setApiOptions] = useState<SearchableSelectOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [selectedOption, setSelectedOption] = useState<SearchableSelectOption | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const apiFunctionRef = React.useRef(apiFunction);
  const loadByIdFunctionRef = React.useRef(loadByIdFunction);
  const apiExtraParamsRef = React.useRef(apiExtraParams);
  const finalOptionsRef = React.useRef(options);
  const openRef = React.useRef(open);
  const pendingOpenAfterSelectedLoadRef = React.useRef(false);
  const listId = React.useId();

  useEffect(() => {
    apiFunctionRef.current = apiFunction;
  }, [apiFunction]);

  useEffect(() => {
    loadByIdFunctionRef.current = loadByIdFunction;
  }, [loadByIdFunction]);

  useEffect(() => {
    apiExtraParamsRef.current = apiExtraParams;
  }, [apiExtraParams]);

  // Use field values if provided (React Hook Form integration)
  const controlledValue = field?.value ?? value;
  const controlledOnChange = field?.onChange ?? onValueChange;

  // Internal state for controlled/uncontrolled behavior
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const currentValue = controlledValue ?? internalValue;

  const isLoading = externalLoading || internalLoading || selectedOptionLoading;
  const isInteractionDisabled = disabled || (!inlineSearchTrigger && selectedOptionLoading);
  const finalOptions = useMemo(
    () => (apiUrl || apiFunction ? apiOptions : options),
    [apiUrl, apiFunction, apiOptions, options],
  );

  useEffect(() => {
    finalOptionsRef.current = finalOptions;
  }, [finalOptions]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const getInlineOpenSearchText = useCallback(() => {
    if (!persistSearchText || !currentValue) {
      return '';
    }

    return (
      selectedOption?.label ||
      finalOptions.find((option) => option.value === currentValue)?.label ||
      String(currentValue)
    );
  }, [currentValue, finalOptions, persistSearchText, selectedOption?.label]);
  const focusInlineSearchInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);
  const visibleOptions = useMemo(() => {
    if (apiUrl || apiFunction) {
      return finalOptions;
    }

    const normalizedSearch = normalizeSearchText(search);
    if (!normalizedSearch) {
      return finalOptions;
    }

    return finalOptions.filter((option) =>
      normalizeSearchText(`${option.value} ${option.label}`).includes(normalizedSearch),
    );
  }, [apiFunction, apiUrl, finalOptions, search]);

  // Load selected option by ID when value changes.
  useEffect(() => {
    if (!currentValue) {
      setSelectedOption(null);
      setSelectedOptionLoading(false);
      return;
    }

    const matchedOption = finalOptionsRef.current.find((option) => option.value === currentValue) ?? null;
    if (matchedOption) {
      setSelectedOption(matchedOption);
      setSelectedOptionLoading(false);
      if (!openRef.current && persistSearchText) {
        setSearch(matchedOption.label);
      }
      return;
    }

    if (!loadByIdFunctionRef.current || selectedOption?.value === currentValue) {
      setSelectedOptionLoading(false);
      return;
    }

    let cancelled = false;

    let loadedOption: SearchableSelectOption | null = null;

    setSelectedOptionLoading(true);
    loadByIdFunctionRef
      .current(currentValue)
      .then((option) => {
        if (!cancelled) {
          loadedOption = option;
          setSelectedOption(option);
          if (option && persistSearchText && !openRef.current) {
            setSearch(option.label);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load option by ID:', err);
          setSelectedOption(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSelectedOptionLoading(false);
          if (pendingOpenAfterSelectedLoadRef.current) {
            pendingOpenAfterSelectedLoadRef.current = false;
            if (inlineSearchTrigger) {
              const nextSearch = loadedOption?.label || String(currentValue);
              setSearch(nextSearch);
              focusInlineSearchInput();
            }
            setOpen(true);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentValue, focusInlineSearchInput, inlineSearchTrigger, persistSearchText, selectedOption?.value]);

  // API call function
  const fetchOptions = useCallback(
    async (searchTerm: string = '') => {
      if (!apiUrl && !apiFunctionRef.current) {
        return;
      }

      setInternalLoading(true);
      setError(null);

      try {
        let data: SearchableSelectOption[] = [];

        if (apiFunctionRef.current) {
          // Use the provided API function
          const params = {
            ...(apiExtraParamsRef.current ?? {}),
            page: 1,
            page_size: apiPageSize,
            ...(searchTerm ? { [searchKey]: searchTerm } : {}),
          };
          const result = await apiFunctionRef.current(params);
          data = Array.isArray(result) ? result : (result as any)?.data || [];
        } else if (apiUrl) {
          // Fallback to URL-based axios call
          const params: Record<string, string | number> = {
            page: 1,
            page_size: apiPageSize,
          };
          Object.entries(apiExtraParamsRef.current ?? {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              params[key] = String(value);
            }
          });
          if (searchTerm) {
            params[searchKey] = searchTerm;
          }

          const response = await API.get<{ data: SearchableSelectOption[] }>(apiUrl, { params });
          data = response.data.data;
        }

        setApiOptions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch options');
        setApiOptions([]);
      } finally {
        setInternalLoading(false);
      }
    },
    [apiPageSize, apiUrl, searchKey],
  );

  // Debounced search effect
  useEffect(() => {
    if (!apiUrl && !apiFunction) {
      return;
    }

    if (search.length < minSearchLength) {
      if (fetchOnOpen && open && search.length === 0) {
        setHasInitialLoad(true);
        fetchOptions('');
        return;
      }
      setApiOptions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchOptions(search);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, fetchOptions, debounceMs, fetchOnOpen, hasInitialLoad, minSearchLength, open]);

  // Load initial data when dropdown opens
  useEffect(() => {
    if (open && fetchOnOpen && (apiUrl || apiFunction) && !hasInitialLoad && search.length === 0) {
      setHasInitialLoad(true);
      fetchOptions('');
    }
  }, [open, fetchOnOpen, apiUrl, apiFunction, hasInitialLoad, search.length, fetchOptions]);

  useEffect(() => {
    if (!open) {
      setHasInitialLoad(false);
      return;
    }

    if (inlineSearchTrigger) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [inlineSearchTrigger, open]);

  const handleSearchChange = useCallback(
    (newSearch: string) => {
      setSearch(newSearch);
      if (clearOnEmptySearch && inlineSearchTrigger && newSearch === '' && currentValue) {
        if (controlledValue === undefined) {
          setInternalValue('');
        }
        controlledOnChange?.('');
        setSelectedOption(null);
        onOptionSelect?.(null);
      }
      onSearchChange?.(newSearch);
    },
    [
      clearOnEmptySearch,
      controlledOnChange,
      controlledValue,
      currentValue,
      inlineSearchTrigger,
      onOptionSelect,
      onSearchChange,
    ],
  );

  const handleValueChange = useCallback(
    (newValue: string, providedOption?: SearchableSelectOption | null) => {
      if (controlledValue === undefined) {
        setInternalValue(newValue);
      }
      controlledOnChange?.(newValue);

      // Update selected option when value changes
      const resolvedOption = providedOption ?? finalOptions.find((option) => option.value === newValue) ?? null;
      if (resolvedOption) {
        setSelectedOption(resolvedOption);
        setSearch(resolvedOption.label);
      } else if (!newValue) {
        setSelectedOption(null);
        setSearch('');
      }
      onOptionSelect?.(resolvedOption);

      setOpen(false);
    },
    [controlledValue, controlledOnChange, finalOptions, onOptionSelect],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedOption(null);
      setSearch('');
      setInternalValue('');
      setApiOptions([]);
      setHasInitialLoad(false);
      handleValueChange('');
    },
    [handleValueChange],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && selectedOptionLoading && !inlineSearchTrigger) {
        pendingOpenAfterSelectedLoadRef.current = true;
        return;
      }

      if (nextOpen && inlineSearchTrigger) {
        const nextSearch = getInlineOpenSearchText();
        setSearch(nextSearch);
        focusInlineSearchInput();
      }
      openRef.current = nextOpen;
      setOpen(nextOpen);
    },
    [focusInlineSearchInput, getInlineOpenSearchText, inlineSearchTrigger, selectedOptionLoading],
  );

  const openInlineSearch = useCallback(() => {
    if (disabled) {
      return;
    }

    if (selectedOptionLoading && !inlineSearchTrigger) {
      pendingOpenAfterSelectedLoadRef.current = true;
      return;
    }

    if (inlineSearchTrigger) {
      const nextSearch = getInlineOpenSearchText();
      setSearch(nextSearch);
      focusInlineSearchInput();
    }
    openRef.current = true;
    setOpen(true);
  }, [disabled, focusInlineSearchInput, getInlineOpenSearchText, inlineSearchTrigger, selectedOptionLoading]);

  // Get a display option from either search results or selected option
  const displayOption = useMemo(() => {
    const foundInOptions = finalOptions.find((option) => option.value === currentValue);
    return foundInOptions || selectedOption;
  }, [finalOptions, currentValue, selectedOption]);

  const currentValueText = currentValue === undefined || currentValue === null ? '' : String(currentValue);
  const inlineFallbackDisplayValue = inlineSearchTrigger && currentValueText ? currentValueText : '';
  const displayValue = displayOption?.label || inlineFallbackDisplayValue || placeholder;
  const hasValue = Boolean(currentValueText && (displayOption || inlineFallbackDisplayValue));
  const triggerInputValue = inlineSearchTrigger
    ? open
      ? search
      : hasValue
        ? displayValue
        : persistSearchText
          ? search
          : ''
    : '';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {inlineSearchTrigger ? (
          <div
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-disabled={isInteractionDisabled}
            tabIndex={-1}
            className={cn(
              'flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
              disabled && 'cursor-not-allowed opacity-50',
              selectedOptionLoading && 'cursor-wait opacity-60',
              className,
              triggerClassName,
            )}
            onMouseDown={() => {
              if (selectedOptionLoading && !disabled && !inlineSearchTrigger) {
                pendingOpenAfterSelectedLoadRef.current = true;
              }
            }}
            {...props}>
            <input
              ref={searchInputRef}
              type="text"
              value={triggerInputValue}
              placeholder={open ? searchPlaceholder : placeholder}
              disabled={disabled}
              readOnly={selectedOptionLoading && !inlineSearchTrigger}
              aria-busy={selectedOptionLoading}
              className={cn(
                'min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground',
                !open && !hasValue && 'text-muted-foreground',
              )}
              onFocus={(event) => {
                if (!open && hasValue) {
                  event.currentTarget.select();
                }
              }}
              onClick={openInlineSearch}
              onChange={(event) => {
                if (selectedOptionLoading && !inlineSearchTrigger) {
                  pendingOpenAfterSelectedLoadRef.current = true;
                  return;
                }
                if (!open) {
                  openRef.current = true;
                  setOpen(true);
                }
                handleSearchChange(event.target.value);
              }}
            />
            <div className="ml-2 flex items-center gap-1">
              {clearable && hasValue && !isInteractionDisabled && (
                <span
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleSearchChange('');
                    handleClear(event);
                  }}
                  className="flex items-center justify-center rounded-sm p-0.5 transition-colors hover:bg-gray-100"
                  aria-hidden="true">
                  <X className="h-3 w-3 opacity-50 transition-opacity hover:opacity-100" />
                </span>
              )}
              <span
                className={cn(
                  'flex items-center justify-center rounded-sm p-0.5 transition-colors hover:bg-gray-100',
                  isInteractionDisabled ? 'cursor-wait opacity-50' : 'cursor-pointer',
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (open) {
                    setOpen(false);
                  } else {
                    openInlineSearch();
                  }
                }}
                aria-hidden="true">
                {selectedOptionLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-50" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                )}
              </span>
            </div>
          </div>
        ) : (
          <Button
            ref={ref}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            className={cn(
              'w-full justify-between font-normal',
              !hasValue && 'text-muted-foreground',
              className,
              triggerClassName,
            )}
            disabled={isInteractionDisabled}
            {...props}>
            <span className="truncate">{displayValue}</span>
            <div className="flex items-center gap-1">
              {clearable && hasValue && !disabled && (
                <span
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleClear(event);
                  }}
                  className="flex items-center justify-center hover:bg-gray-100 rounded-sm p-0.5 transition-colors"
                  aria-hidden="true">
                  <X className="h-3 w-3 opacity-50 hover:opacity-100 transition-opacity" />
                </span>
              )}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-full p-0', contentClassName)}
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        onWheelCapture={(event) => {
          event.stopPropagation();
        }}
        onTouchMoveCapture={(event) => {
          event.stopPropagation();
        }}
        onOpenAutoFocus={(event) => {
          if (inlineSearchTrigger) {
            event.preventDefault();
          }
        }}
        onCloseAutoFocus={(event) => {
          if (inlineSearchTrigger) {
            event.preventDefault();
          }
        }}>
        <Command shouldFilter={false}>
          {!inlineSearchTrigger && (
            <div className="flex items-center border-b px-3">
              <div className="flex items-center flex-1">
                <Search className="mr-2 size-4 shrink-0 opacity-50" />
                <CommandPrimitive.Input
                  ref={searchInputRef}
                  placeholder={searchPlaceholder}
                  value={search}
                  onValueChange={handleSearchChange}
                  className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              {isLoading && <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />}
            </div>
          )}
          <CommandList
            id={listId}
            style={{
              maxHeight,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
            onWheelCapture={(event) => {
              event.stopPropagation();
            }}
            onTouchMoveCapture={(event) => {
              event.stopPropagation();
            }}>
            {error ? (
              <div className="p-4 text-sm text-destructive text-center">{error}</div>
            ) : isLoading && visibleOptions.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
            ) : visibleOptions.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
              <CommandGroup>
                {visibleOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.value} ${option.label}`}
                    onSelect={() => handleValueChange(option.value, option)}
                    className="cursor-pointer">
                    <div className="flex items-center justify-between w-full">
                      <span>{option.label}</span>
                      {currentValue === option.value && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

SearchableSelect.displayName = 'SearchableSelect';

export { SearchableSelect };
