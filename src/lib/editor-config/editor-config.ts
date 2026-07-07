import { getSchemaFieldCatalog, type ExactSchemaCatalog } from '../template-data';
import type { ClassicEditor, Editor } from 'ckeditor5';
import {
  DOCUMENT_TEMPLATE_DOCX_BORDER_ATTR,
  DOCUMENT_TEMPLATE_WRAPPER_ATTR,
  DOCUMENT_TEMPLATE_WRAPPER_NAME_ATTR,
} from '../document-templates';
import { getEditorGlobalStyle } from '../editor-style';
import { toMentionRecordText } from '../mentions';
import { getVariablePickerItems } from './variable-picker';

type CkeditorModule = typeof import('ckeditor5');
type CkeditorReactModule = typeof import('@ckeditor/ckeditor5-react');

export interface EditorRuntime {
  CKEditor: CkeditorReactModule['CKEditor'];
  ClassicEditor: CkeditorModule['ClassicEditor'];
}

export interface ICreateEditorConfigOptions {
  includeSourceEditing?: boolean;
  allowRawHtmlLayout?: boolean;
}

const EDITOR_FONT_SIZE_OPTIONS = ['default', '10pt', '11pt', '12pt', '13pt', '14pt', '16pt', '18pt', '20pt'] as const;

let ckeditorModulePromise: Promise<CkeditorModule> | null = null;
let ckeditorReactModulePromise: Promise<CkeditorReactModule> | null = null;
let ckeditorStylesPromise: Promise<unknown> | null = null;

function loadCkeditorModule(): Promise<CkeditorModule> {
  if (!ckeditorModulePromise) {
    ckeditorModulePromise = import('ckeditor5');
  }

  return ckeditorModulePromise;
}

function loadCkeditorReactModule(): Promise<CkeditorReactModule> {
  if (!ckeditorReactModulePromise) {
    ckeditorReactModulePromise = import('@ckeditor/ckeditor5-react');
  }

  return ckeditorReactModulePromise;
}

function loadCkeditorStyles(): Promise<unknown> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (!ckeditorStylesPromise) {
    ckeditorStylesPromise = import('ckeditor5/ckeditor5.css');
  }

  return ckeditorStylesPromise;
}

export async function loadEditorRuntime(): Promise<EditorRuntime> {
  const [ckeditorModule, ckeditorReactModule] = await Promise.all([
    loadCkeditorModule(),
    loadCkeditorReactModule(),
    loadCkeditorStyles(),
  ]);

  return {
    CKEditor: ckeditorReactModule.CKEditor,
    ClassicEditor: ckeditorModule.ClassicEditor,
  };
}

async function variableFeed(
  queryText: string,
  _onTableSelect?: (tableName: string) => void,
  catalog: ExactSchemaCatalog = getSchemaFieldCatalog(),
  template_type?: string | null,
) {
  return getVariablePickerItems(queryText, catalog, { template_type }).map((item) => ({
    id: item.token,
    text: item.token,
    variableLabel: item.label,
  }));
}

function renderVariableMentionItem(item: Record<string, unknown>) {
  const itemElement = document.createElement('span');
  itemElement.className = 'mention-variable-option';

  const labelElement = document.createElement('span');
  labelElement.className = 'mention-variable-option__label';
  labelElement.textContent = toMentionRecordText(item.variableLabel ?? item.text ?? item.id);

  const keyElement = document.createElement('span');
  keyElement.className = 'mention-variable-option__key';
  keyElement.textContent = toMentionRecordText(item.text ?? item.id);

  itemElement.append(labelElement, keyElement);
  return itemElement;
}

export const attachFontSizeToolbarLabel = (editor: Editor) => {
  const toolbar = editor.ui.view.toolbar;
  if (!toolbar) {
    return;
  }

  const toolbarItems = Array.from(toolbar.items) as Array<{
    buttonView?: {
      label?: string;
      set?: (definition: Record<string, unknown>) => void;
      element?: HTMLElement | null;
    };
  }>;
  const fontSizeToolbarItem = toolbarItems.find((item) => item.buttonView?.label === 'Font Size');
  const buttonView = fontSizeToolbarItem?.buttonView;
  const setButtonView = buttonView?.set;
  const fontSizeCommand = editor.commands.get('fontSize') as {
    value?: unknown;
    on: (event: string, callback: () => void) => void;
  } | null;

  if (!setButtonView || !fontSizeCommand) {
    return;
  }

  const syncButtonLabel = () => {
    const activeValue =
      typeof fontSizeCommand.value === 'string' && fontSizeCommand.value.trim()
        ? fontSizeCommand.value.trim()
        : getEditorGlobalStyle().font_size;

    setButtonView({
      withText: true,
      icon: false,
      label: activeValue,
      tooltip: activeValue,
    });
  };

  syncButtonLabel();
  fontSizeCommand.on('change:value', syncButtonLabel);
};

// async function userMentionFeed(queryText: string) {
//     const users = [{ id: "@hien", name: "Chị Hiền" }];
//     const q = (queryText || "").toLowerCase();
//     return users
//         .filter(
//             (u) =>
//                 u.id.toLowerCase().includes(q) ||
//                 u.name.toLowerCase().includes(q),
//         )
//         .slice(0, 10)
//         .map((u) => ({ id: u.id, text: u.name }));
// }

function createEditorConfigFromModule(
  ckeditor: CkeditorModule,
  catalog?: ExactSchemaCatalog,
  _onEditorReady?: (editor: ClassicEditor) => void,
  template_type?: string | null,
  options: ICreateEditorConfigOptions = {},
) {
  const documentTemplateHtmlAttributes = options.allowRawHtmlLayout
    ? (true as const)
    : [
        DOCUMENT_TEMPLATE_WRAPPER_ATTR,
        DOCUMENT_TEMPLATE_WRAPPER_NAME_ATTR,
        DOCUMENT_TEMPLATE_DOCX_BORDER_ATTR,
        'data-var-key',
        'data-var-occurrence',
      ];
  const contentHtmlAttributes = options.allowRawHtmlLayout
    ? (true as const)
    : [DOCUMENT_TEMPLATE_DOCX_BORDER_ATTR, 'data-var-key', 'data-var-occurrence'];
  const contentHtmlClasses = options.allowRawHtmlLayout ? (true as const) : undefined;
  const {
    Alignment,
    BlockQuote,
    Bold,
    CodeBlock,
    Essentials,
    FileRepository,
    FontBackgroundColor,
    FontColor,
    FontFamily,
    FontSize,
    GeneralHtmlSupport,
    Heading,
    HorizontalLine,
    Image,
    ImageCaption,
    ImageResize,
    ImageStyle,
    ImageToolbar,
    ImageUpload,
    Indent,
    IndentBlock,
    Italic,
    Link,
    List,
    MediaEmbed,
    Mention,
    PageBreak,
    Paragraph,
    RemoveFormat,
    SourceEditing,
    SpecialCharacters,
    Strikethrough,
    Subscript,
    Superscript,
    Table,
    TableCellProperties,
    TableProperties,
    TableToolbar,
    Underline,
  } = ckeditor;

  return {
    licenseKey: 'GPL',
    plugins: [
      Essentials,
      Paragraph,
      Heading,
      Bold,
      Italic,
      Underline,
      Strikethrough,
      Subscript,
      Superscript,
      Link,
      List,
      BlockQuote,
      Table,
      TableToolbar,
      TableProperties,
      TableCellProperties,
      Mention,
      FileRepository,
      Image,
      ImageToolbar,
      ImageCaption,
      ImageResize,
      ImageStyle,
      ImageUpload,
      Alignment,
      FontSize,
      FontFamily,
      FontColor,
      FontBackgroundColor,
      Indent,
      IndentBlock,
      HorizontalLine,
      MediaEmbed,
      RemoveFormat,
      SpecialCharacters,
      CodeBlock,
      PageBreak,
      GeneralHtmlSupport,
      ...(options.includeSourceEditing ? [SourceEditing] : []),
    ],
    toolbar: {
      shouldNotGroupWhenFull: true,
      items: [
        'undo',
        'redo',
        '|',
        'heading',
        'bold',
        'italic',
        'underline',
        'strikethrough',
        'subscript',
        'superscript',
        '|',
        'fontFamily',
        'fontSize',
        'fontColor',
        'fontBackgroundColor',
        '|',
        'link',
        'bulletedList',
        'numberedList',
        'indent',
        'outdent',
        '|',
        'alignment',
        '|',
        'blockQuote',
        'insertTable',
        ...(options.includeSourceEditing ? ['sourceEditing'] : []),
        'codeBlock',
        'horizontalLine',
        'pageBreak',
        '|',
        'removeFormat',
        'specialCharacters',
        '|',
        'uploadImage',
      ],
    },
    fontSize: {
      options: [...EDITOR_FONT_SIZE_OPTIONS],
      supportAllValues: true,
    },
    image: {
      toolbar: [
        'resizeImage',
        'imageStyle:inline',
        'imageStyle:block',
        'imageStyle:side',
        '|',
        'toggleImageCaption',
        'imageTextAlternative',
      ],
      resizeUnit: '%' as const,
      resizeOptions: [
        {
          name: 'resizeImage:original',
          label: 'Original',
          value: null,
        },
        {
          name: 'resizeImage:custom',
          label: 'Custom',
          value: 'custom',
        },
        {
          name: 'resizeImage:25',
          label: '25%',
          value: '25',
        },
        {
          name: 'resizeImage:50',
          label: '50%',
          value: '50',
        },
        {
          name: 'resizeImage:75',
          label: '75%',
          value: '75',
        },
      ],
    },
    table: {
      contentToolbar: [
        'tableColumn',
        'tableRow',
        'mergeTableCells',
        'tableProperties',
        'tableCellProperties',
        'toggleTableCaption',
        'tableCaptionProperties',
      ],
    },
    mention: {
      feeds: [
        {
          marker: '{{',
          minimumCharacters: 0,
          feed: (queryText: string) =>
            variableFeed(
              queryText,
              undefined,
              catalog && Object.keys(catalog).length > 0 ? catalog : getSchemaFieldCatalog(),
              template_type,
            ),
          itemRenderer: renderVariableMentionItem,
        },
      ],
    },
    extraPlugins: [],
    htmlSupport: {
      allow: [
        {
          // Preserve the wrapper <div> used by document-template
          // variables so that rebuild/removal can locate the entire
          // rendered block via data-attributes.
          name: 'div',
          attributes: documentTemplateHtmlAttributes,
          classes: contentHtmlClasses,
          styles: true as const,
        },
        {
          // Allow inline styles on <p> and <span> inside document
          // templates (margins, font sizes, colours, etc.)
          name: /^(p|span|table|tr|td|th|tbody|thead|tfoot|figure|img|ul|ol|li|blockquote|h[1-6]|strong|b|em|i|u|br|a|sup|sub|hr)$/,
          attributes: contentHtmlAttributes,
          classes: contentHtmlClasses,
          styles: true as const,
        },
      ],
    },
  };
}

export async function createEditorConfig(
  catalog?: ExactSchemaCatalog,
  onEditorReady?: (editor: ClassicEditor) => void,
  template_type?: string | null,
  options?: ICreateEditorConfigOptions,
) {
  const ckeditor = await loadCkeditorModule();
  return createEditorConfigFromModule(ckeditor, catalog, onEditorReady, template_type, options);
}

export async function createPreviewEditorConfig(
  catalog?: ExactSchemaCatalog,
  template_type?: string | null,
  options?: ICreateEditorConfigOptions,
) {
  const config = await createEditorConfig(catalog, undefined, template_type, options);
  return {
    ...config,
    ui: {
      viewportOffset: {
        top: 0,
        bottom: 0,
      },
    },
    toolbar: {
      ...config.toolbar,
      shouldNotGroupWhenFull: true,
    },
  };
}
