import type { TMimeCategory } from '../../file-preview-modal.type';

export interface IDocumentCanvasProps {
  fileName: string;
  mimeCategory: TMimeCategory;
  loading: boolean;
  error: string | null;
  blobUrl: string | null;
  fileUrl?: string | null;
  textContent: string | null;
  docxHtml: string | null;
  excelSheets: Array<{ name: string; html: string }>;
  activeSheetIndex: number;
  onSheetChange: (index: number) => void;
  pptxSlides: Array<{ number: number; text: string; images: string[] }>;
  activeSlideIndex: number;
  onSlideChange: (index: number) => void;
  zoomLevel: number;
}
