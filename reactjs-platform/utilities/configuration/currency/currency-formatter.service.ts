import { CURRENCY_ENABLE_COMPACT } from 'reactjs-platform/utilities/constants';

class CurrencyFormatterFactory {
  private currencyFormatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  });

  public format(value: number, compact?: boolean) {
    const number = Math.floor(value);
    const formatNumber = this.currencyFormatter.format(Number.isNaN(number) || !number ? 0 : number);
    return compact ? this.compact(formatNumber) : formatNumber;
  }

  public formatCurrency(value: number, compact?: boolean, currencySymbol: string = '£') {
    if (!value) {
      return '';
    }
    const number = Math.floor(value);
    const formatNumber = this.currencyFormatter.format(Number.isNaN(number) || !number ? 0 : number);
    const formattedValue = compact ? this.compact(formatNumber) : formatNumber;
    return `${currencySymbol}${formattedValue}`;
  }

  public compact(value: string) {
    if (!CURRENCY_ENABLE_COMPACT) {
      return value;
    }

    if (value.match(/[\d,]{8,}/)) {
      return value.replace(/[\d,]{4}$/, 'K');
    }
    return value;
  }
}

export const CurrencyFormatterService = new CurrencyFormatterFactory();
