export interface IError500Props {
  error: Error | unknown;
  reset?: () => void;
}
