export interface IPreviewToolbarProps {
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onDownload: () => void;
  onPrint: () => void;
}
