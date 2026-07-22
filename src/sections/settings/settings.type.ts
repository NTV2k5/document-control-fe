export type TThemeValue = 'light' | 'dark' | 'system';
export type TDensityValue = 'low' | 'medium';
export type TStartPageValue = 'home' | 'drive';

export interface IGeneralSettings {
  theme: TThemeValue;
  density: TDensityValue;
  startPage: TStartPageValue;
}

export interface ISettingsSectionProps {}
