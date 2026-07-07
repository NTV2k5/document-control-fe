'use client';

import { useId, useRef } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { TemplateShareRules } from '../../template/template-share-rules';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'reactjs-platform/ui';
import type { ITemplateShareRule, MetadataOption, TArtifactType, TemplateVisibility } from 'api';

export type FileSelectEvent = React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLButtonElement>;

export interface IUploadModalProps {
  open: boolean;
  onClose: () => void;
  isDragging: boolean;
  onDraggingChange?: (isDragging: boolean) => void;
  onFileSelect: (event: FileSelectEvent) => void;
  isUploading: boolean;
  templateTypeOptions?: MetadataOption[];
  templateTypeValue?: string;
  onTemplateTypeChange?: (value: string) => void;
  artifactTypeValue?: TArtifactType;
  onArtifactTypeChange?: (value: TArtifactType) => void;
  visibilityValue?: TemplateVisibility;
  onVisibilityChange?: (value: TemplateVisibility) => void;
  share_rules?: ITemplateShareRule[];
  onShareRulesChange?: (share_rules: ITemplateShareRule[]) => void;
  organizationUnitOptions?: MetadataOption[];
  acceptedFileTypes?: string;
  uploadHint?: string;
}

export const UploadModal = ({
  open,
  onClose,
  isDragging,
  onDraggingChange,
  onFileSelect,
  isUploading,
  templateTypeOptions = [],
  templateTypeValue = '',
  onTemplateTypeChange,
  artifactTypeValue = 'rich_text',
  onArtifactTypeChange,
  visibilityValue = 'PRIVATE',
  onVisibilityChange,
  share_rules = [],
  onShareRulesChange,
  organizationUnitOptions = [],
  acceptedFileTypes = '.doc,.docx,.xlsx,.xls,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.pdf',
  uploadHint = 'Thả file Word, Excel, PowerPoint, ảnh hoặc PDF vào đây',
}: IUploadModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const artifactTypeFieldId = useId();
  const templateTypeFieldId = useId();
  const visibilityFieldId = useId();
  const uploadFieldId = useId();
  const titleId = useId();

  const handleZoneClick = () => {
    if (!isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-black/50"
        onClick={onClose}
        disabled={isUploading}
        aria-label="Đóng modal tải mẫu"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-lg bg-white shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id={titleId} className="text-base font-semibold text-[#002147]">
            Tải mẫu lên
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {onArtifactTypeChange ? (
            <div className="mb-4 space-y-2">
              <span className="text-sm font-medium text-gray-700">Định dạng tài liệu</span>
              <Select value={artifactTypeValue} onValueChange={(value) => onArtifactTypeChange(value as TArtifactType)}>
                <SelectTrigger
                  id={artifactTypeFieldId}
                  aria-label="Định dạng tài liệu"
                  className="h-11 rounded-lg border-gray-300">
                  <SelectValue placeholder="Chọn định dạng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rich_text">Word / Rich text</SelectItem>
                  <SelectItem value="spreadsheet">Excel / Spreadsheet</SelectItem>
                  <SelectItem value="presentation">PowerPoint</SelectItem>
                  <SelectItem value="image_form">Image / Form fill</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="mb-4 space-y-2">
            <span className="text-sm font-medium text-gray-700">Loại mẫu</span>
            <Select value={templateTypeValue || undefined} onValueChange={onTemplateTypeChange}>
              <SelectTrigger id={templateTypeFieldId} aria-label="Loại mẫu" className="h-11 rounded-lg border-gray-300">
                <SelectValue placeholder="Chọn loại mẫu" />
              </SelectTrigger>
              <SelectContent>
                {templateTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {onVisibilityChange ? (
            <div className="mb-4 space-y-2">
              <span className="text-sm font-medium text-gray-700">Phạm vi hiển thị</span>
              <Select
                value={visibilityValue}
                onValueChange={(value) => onVisibilityChange(value as TemplateVisibility)}>
                <SelectTrigger
                  id={visibilityFieldId}
                  aria-label="Phạm vi hiển thị"
                  className="h-11 rounded-lg border-gray-300">
                  <SelectValue placeholder="Chọn phạm vi hiển thị" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">Riêng tư</SelectItem>
                  <SelectItem value="RESTRICTED">Giới hạn</SelectItem>
                  <SelectItem value="PUBLIC">Công khai</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {visibilityValue === 'RESTRICTED' ? (
            <div className="mb-4">
              <TemplateShareRules
                share_rules={share_rules}
                onShareRulesChange={(nextShareRules) => onShareRulesChange?.(nextShareRules)}
                organizationUnitOptions={organizationUnitOptions}
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleZoneClick}
            onDragOver={(e) => {
              if (!isUploading) {
                e.preventDefault();
                onDraggingChange?.(true);
              }
            }}
            onDragLeave={() => onDraggingChange?.(false)}
            onDrop={(e) => {
              if (!isUploading) {
                e.preventDefault();
                onFileSelect(e);
              }
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
              isDragging
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
            } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}>
            {isUploading ? (
              <Loader2 className="size-8 animate-spin text-gray-400" />
            ) : (
              <Upload className="size-8 text-gray-400" />
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">{isUploading ? 'Đang tải lên...' : uploadHint}</p>
              <p className="mt-1 text-xs text-gray-500">hoặc bấm để chọn file</p>
            </div>
          </button>
          <input
            id={uploadFieldId}
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes}
            onChange={onFileSelect}
            className="hidden"
            disabled={isUploading}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-200 px-6 py-4">
          <Button size="sm" variant="outline" onClick={onClose} disabled={isUploading}>
            Hủy
          </Button>
        </div>
      </div>
    </div>
  );
};
