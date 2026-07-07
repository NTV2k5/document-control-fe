import { useCallback, useState } from 'react';

import type {
  IDocumentInputAgentActionPromptContext,
  IDocumentInputAgentSelectedTemplate,
  TDocumentInputAgentComposerActionId,
  TDocumentInputAgentCreateDocumentMode,
  TDocumentInputAgentSourceKind,
} from './document-input-agent-action.type';

const detectSourceKindFromFile = (
  file: IDocumentInputAgentActionPromptContext['files'][number],
): TDocumentInputAgentSourceKind => {
  const name = `${file.local_name || file.original_name || ''}`.toLowerCase();
  const mimeType = `${file.mime_type || ''}`.toLowerCase();

  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv')
  ) {
    return 'spreadsheet';
  }

  if (
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint') ||
    name.endsWith('.ppt') ||
    name.endsWith('.pptx')
  ) {
    return 'presentation';
  }

  if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name)) {
    return 'image';
  }

  if (mimeType.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    return 'text';
  }

  if (
    mimeType.includes('word') ||
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    name.endsWith('.pdf')
  ) {
    return 'document';
  }

  return 'unknown';
};

const detectSourceKindFromTemplate = (template: IDocumentInputAgentSelectedTemplate): TDocumentInputAgentSourceKind => {
  switch (template.artifact_type) {
    case 'spreadsheet':
      return 'spreadsheet';
    case 'presentation':
      return 'presentation';
    case 'image_form':
      return 'image';
    case 'rich_text':
      return 'document';
    default:
      return 'unknown';
  }
};

const detectSourceKind = (
  files: IDocumentInputAgentActionPromptContext['files'],
  template: IDocumentInputAgentSelectedTemplate,
): TDocumentInputAgentSourceKind => {
  const sourceKindFromFile = files.map(detectSourceKindFromFile).find((item) => item !== 'unknown');
  return sourceKindFromFile ?? detectSourceKindFromTemplate(template);
};

const buildVietnameseCreateDocumentPrompt = (
  template: IDocumentInputAgentSelectedTemplate,
  sourceKind: TDocumentInputAgentSourceKind,
  userMessage: string,
  mode: TDocumentInputAgentCreateDocumentMode,
) => {
  const agentRequestInstruction =
    'Tạo document theo yêu cầu tôi nhập trong tin nhắn. Dùng cấu trúc, biến, bảng, field và binding của template để điền dữ liệu; nếu cần dữ liệu hệ thống thì dùng các công cụ/truy vấn có sẵn của agent theo binding/template. Không yêu cầu phải có file upload.';
  const sourceInstructionMap: Record<TDocumentInputAgentSourceKind, string> = {
    spreadsheet:
      'Đọc file Excel/bảng tính tôi vừa upload. Fill dữ liệu theo cell/binding và sheet binding của template nếu có. Nếu binding chỉ rõ sheet thì dùng sheet đó; nếu file chỉ có một sheet thì dùng sheet đó. Nếu workbook có nhiều sheet và binding không chỉ rõ, tự chọn sheet phù hợp nhất theo tên sheet, cấu trúc bảng, header, cell binding hoặc yêu cầu bổ sung của tôi. Nếu không đủ chắc chắn thì hỏi lại tôi chọn sheet; không hardcode tên sheet.',
    document:
      'Đọc file Word/PDF/văn bản tôi vừa upload. Trích xuất dữ liệu theo biến, bảng, field và cấu trúc của template.',
    presentation:
      'Đọc file PowerPoint tôi vừa upload. Trích xuất dữ liệu theo slide, placeholder, field và binding của template.',
    image: 'Đọc ảnh hoặc biểu mẫu tôi vừa upload. Trích xuất dữ liệu theo các field và binding của template.',
    text: 'Đọc nội dung text/markdown tôi vừa upload. Trích xuất dữ liệu theo biến, field và cấu trúc của template.',
    unknown: 'Đọc file tôi vừa upload. Trích xuất dữ liệu theo biến, bảng, field và binding của template.',
  };

  return [
    `Dùng đúng template "${template.name}"${template.id ? ` (template id: ${template.id})` : ''} để tạo document mới.`,
    mode === 'agent_request' ? agentRequestInstruction : sourceInstructionMap[sourceKind],
    'Nếu dữ liệu nguồn trống hoặc không có bằng chứng rõ ràng thì để giá trị rỗng, không tự bịa dữ liệu.',
    'Sau khi tạo xong trả về document id/link để tôi mở kiểm tra.',
    userMessage ? `Yêu cầu của tôi:\n${userMessage}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const buildEnglishCreateDocumentPrompt = (
  template: IDocumentInputAgentSelectedTemplate,
  sourceKind: TDocumentInputAgentSourceKind,
  userMessage: string,
  mode: TDocumentInputAgentCreateDocumentMode,
) => {
  const agentRequestInstruction =
    'Create the document from the instructions I enter in the message. Use the template structure, variables, tables, fields, and bindings to fill data; if system data is needed, use the agent tools/queries available from the bindings/template. An uploaded file is not required.';
  const sourceInstructionMap: Record<TDocumentInputAgentSourceKind, string> = {
    spreadsheet:
      'Read the uploaded Excel/spreadsheet file. Fill data according to the template cell bindings and sheet bindings when available. If the binding explicitly identifies a sheet, use that sheet; if the file has only one sheet, use that sheet. If the workbook has multiple sheets and no explicit sheet binding, choose the best matching sheet from sheet names, table structure, headers, cell bindings, or my extra instructions. If you are not confident enough, ask me to choose the sheet; do not hardcode a sheet name.',
    document:
      'Read the uploaded Word/PDF/document file. Extract data according to the variables, tables, fields, and structure of the template.',
    presentation:
      'Read the uploaded PowerPoint file. Extract data according to the slides, placeholders, fields, and bindings of the template.',
    image: 'Read the uploaded image or form. Extract data according to the fields and bindings of the template.',
    text: 'Read the uploaded text/markdown content. Extract data according to the variables, fields, and structure of the template.',
    unknown:
      'Read the uploaded file. Extract data according to the variables, tables, fields, and bindings of the template.',
  };

  return [
    `Use the exact template "${template.name}"${template.id ? ` (template id: ${template.id})` : ''} to create a new document.`,
    mode === 'agent_request' ? agentRequestInstruction : sourceInstructionMap[sourceKind],
    'If source data is empty or not clearly supported by evidence, leave the value empty and do not invent data.',
    'After creating it, return the document id/link so I can review it.',
    userMessage ? `My request:\n${userMessage}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const buildCreateDocumentPrompt = (
  template: IDocumentInputAgentSelectedTemplate,
  context: IDocumentInputAgentActionPromptContext,
  mode: TDocumentInputAgentCreateDocumentMode,
) => {
  const sourceKind = detectSourceKind(context.files, template);
  const userMessage = context.userMessage.trim();
  const isVietnamese = context.locale === 'vi';

  return isVietnamese
    ? buildVietnameseCreateDocumentPrompt(template, sourceKind, userMessage, mode)
    : buildEnglishCreateDocumentPrompt(template, sourceKind, userMessage, mode);
};

const normalizePromptText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const isPromptAlreadyScopedToTemplate = (message: string, template: IDocumentInputAgentSelectedTemplate) => {
  const normalizedMessage = normalizePromptText(message);
  const normalizedTemplateName = normalizePromptText(template.name);
  const normalizedTemplateId = normalizePromptText(template.id);
  const hasGeneratedPromptOpening =
    normalizedMessage.startsWith('dùng đúng template') || normalizedMessage.startsWith('use the exact template');
  const hasGeneratedPromptClosing =
    normalizedMessage.includes('sau khi tạo xong') || normalizedMessage.includes('after creating it');

  return (
    hasGeneratedPromptOpening &&
    hasGeneratedPromptClosing &&
    ((normalizedTemplateId.length > 0 && normalizedMessage.includes(normalizedTemplateId)) ||
      (normalizedTemplateName.length > 0 && normalizedMessage.includes(normalizedTemplateName)))
  );
};

export const useDocumentInputAgentActions = () => {
  const [activeActionId, setActiveActionId] = useState<TDocumentInputAgentComposerActionId | null>(null);
  const [createDocumentMode, setCreateDocumentMode] = useState<TDocumentInputAgentCreateDocumentMode | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<IDocumentInputAgentSelectedTemplate | null>(null);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);

  const openCreateDocumentAction = () => {
    setActiveActionId('create_document');
    setIsTemplateSelectorOpen(true);
  };

  const selectCreateDocumentTemplate = (template: IDocumentInputAgentSelectedTemplate) => {
    setActiveActionId('create_document');
    setCreateDocumentMode(null);
    setSelectedTemplate(template);
    setIsTemplateSelectorOpen(false);
  };

  const selectCreateDocumentUploadSource = () => {
    setActiveActionId('create_document');
    setCreateDocumentMode('upload_source');
  };

  const clearCreateDocumentAction = () => {
    setActiveActionId(null);
    setCreateDocumentMode(null);
    setSelectedTemplate(null);
    setIsTemplateSelectorOpen(false);
  };

  const buildCreateDocumentMessage = useCallback(
    (
      context: IDocumentInputAgentActionPromptContext,
      options: {
        mode?: TDocumentInputAgentCreateDocumentMode;
        template?: IDocumentInputAgentSelectedTemplate;
      } = {},
    ) => {
      const template = options.template ?? selectedTemplate;
      if (!template) return '';

      const mode = options.mode ?? createDocumentMode ?? (context.files.length > 0 ? 'upload_source' : 'agent_request');

      return buildCreateDocumentPrompt(template, context, mode);
    },
    [createDocumentMode, selectedTemplate],
  );

  const buildSubmitMessage = (context: IDocumentInputAgentActionPromptContext) => {
    if (activeActionId !== 'create_document' || !selectedTemplate) {
      return context.userMessage.trim();
    }

    const userMessage = context.userMessage.trim();
    if (userMessage && isPromptAlreadyScopedToTemplate(userMessage, selectedTemplate)) {
      return userMessage;
    }

    return buildCreateDocumentMessage(context);
  };

  return {
    activeActionId,
    createDocumentMode,
    selectedTemplate,
    isTemplateSelectorOpen,
    setTemplateSelectorOpen: setIsTemplateSelectorOpen,
    openCreateDocumentAction,
    selectCreateDocumentTemplate,
    selectCreateDocumentUploadSource,
    clearCreateDocumentAction,
    resetAction: clearCreateDocumentAction,
    buildCreateDocumentMessage,
    buildSubmitMessage,
  };
};
