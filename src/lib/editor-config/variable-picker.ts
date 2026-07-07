import type { ClassicEditor, ModelRange } from 'ckeditor5';
import { HIDDEN_TABLES, MENTION_BLACKLIST } from '../constants';
import {
  DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
  generateDocumentHtml,
  getDocumentTemplateById,
  getDocumentTemplateVariableFields,
  serializeDocumentMultiReferenceListValue,
  type DocumentField,
  type DocumentSection,
  type DocumentTemplate,
} from '../document-templates';
import {
  getForeignKeyMeta,
  getSchemaFieldCatalog,
  getTemplateVariableDefinitionByKey,
  getTemplateVariableDefinitions,
  getTemplateVariableSourceTables,
  getTemplateVariableTableTemplateByKey,
  templateVariableMatchesTemplateType,
  type ExactSchemaCatalog,
} from '../template-data';
import {
  generateTableHtmlFromTableTemplate,
  getTableTemplateById,
  getTableTemplateVariableFields,
  TABLE_TEMPLATE_VARIABLE_NAMESPACE,
  type TableTemplate,
} from '../table-templates';
import {
  isCheckVariableInputType,
  isImageVariableInputType,
  isNumberVariableInputType,
  isSelectVariableInputType,
} from '../templates';
import { getVariableAlias, getVariableTableAlias, normalizeAliasSearchText } from '../variable-aliases';

export type TVariablePickerScope = 'field' | 'tableTemplate' | 'documentTemplate';
export type TVariablePickerInsertMode = 'inline' | 'block';
export type TVariablePickerDataKind = 'text' | 'number' | 'reference' | 'flag' | 'table' | 'document';
export type TVariableDefinitionType = 'FIELD_VARIABLE' | 'TABLE_VARIABLE' | 'DOCUMENT_VARIABLE';
type TVariablePickerTranslate = (
  key: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) => string;

interface IVariablePickerOptions {
  template_type?: string | null;
  t?: TVariablePickerTranslate;
}

export interface IVariablePickerItem {
  key: string;
  token: string;
  label: string;
  groupKey: string;
  groupLabel: string;
  scope: TVariablePickerScope;
  variableType: TVariableDefinitionType;
  sourceTable?: string | null;
  sourceTableLabel?: string | null;
  searchText: string;
  subtitle: string;
  insertMode: TVariablePickerInsertMode;
  dataKind: TVariablePickerDataKind;
  dataLabel: string;
  renderLabel: string;
  renderHint: string;
}

const VARIABLE_SCOPE_ORDER: Record<TVariablePickerScope, number> = {
  field: 0,
  tableTemplate: 1,
  documentTemplate: 2,
};

const splitDefinitionKey = (key: string) => {
  const [tableName, ...fieldParts] = key.split('.');
  const fieldName = fieldParts.join('.');

  return tableName && fieldName ? { tableName, fieldName } : null;
};

const addCatalogField = (catalog: Record<string, string[]>, tableName: string, fieldName: string) => {
  const fields = catalog[tableName] ?? [];

  if (!fields.includes(fieldName)) {
    catalog[tableName] = [...fields, fieldName];
  }
};

const interpolateFallback = (value: string, params?: Record<string, string | number | boolean | null | undefined>) => {
  if (!params) return value;

  return value.replace(/\{\{(\w+)\}\}/g, (_, paramKey: string) => {
    const paramValue = params[paramKey];
    return paramValue == null ? '' : String(paramValue);
  });
};

const translatePickerText = (
  translate: TVariablePickerTranslate | undefined,
  key: string,
  fallback: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) => (translate ? translate(key, params) : interpolateFallback(fallback, params));

const getDynamicFieldVariableCatalog = (template_type?: string | null) => {
  const catalog: Record<string, string[]> = {};

  getTemplateVariableDefinitions()
    .filter(
      (definition) =>
        definition.variableType === 'FIELD_VARIABLE' && templateVariableMatchesTemplateType(definition, template_type),
    )
    .forEach((definition) => {
      const keyParts = splitDefinitionKey(definition.key);
      if (!keyParts) return;

      addCatalogField(catalog, keyParts.tableName, keyParts.fieldName);
    });

  return catalog;
};

const getDynamicTableVariableFields = (template_type?: string | null) =>
  getTemplateVariableDefinitions()
    .filter(
      (definition) =>
        definition.variableType === 'TABLE_VARIABLE' &&
        definition.key.startsWith(`${TABLE_TEMPLATE_VARIABLE_NAMESPACE}.`) &&
        templateVariableMatchesTemplateType(definition, template_type),
    )
    .map((definition) => definition.key.slice(TABLE_TEMPLATE_VARIABLE_NAMESPACE.length + 1))
    .filter(Boolean);

const getVariableCatalogWithTemplates = (
  catalog: ExactSchemaCatalog = getSchemaFieldCatalog(),
  template_type?: string | null,
) => {
  const dynamicFieldCatalog = getDynamicFieldVariableCatalog(template_type);
  const baseCatalog = Object.keys(dynamicFieldCatalog).length > 0 ? dynamicFieldCatalog : catalog;
  const tableTemplateFields = Array.from(
    new Set([
      ...(baseCatalog[TABLE_TEMPLATE_VARIABLE_NAMESPACE] ?? []),
      ...getDynamicTableVariableFields(template_type),
      ...getTableTemplateVariableFields(),
    ]),
  );
  const documentTemplateFields = Array.from(
    new Set([...(baseCatalog[DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE] ?? []), ...getDocumentTemplateVariableFields()]),
  );

  return {
    ...baseCatalog,
    [TABLE_TEMPLATE_VARIABLE_NAMESPACE]: tableTemplateFields,
    [DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE]: documentTemplateFields,
  } as Record<string, readonly string[]>;
};

const getVariableScope = (tableName: string): TVariablePickerScope => {
  if (tableName === TABLE_TEMPLATE_VARIABLE_NAMESPACE) {
    return 'tableTemplate';
  }

  if (tableName === DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE) {
    return 'documentTemplate';
  }

  return 'field';
};

const getVariableGroupLabel = (tableName: string, translate?: TVariablePickerTranslate): string => {
  if (tableName === TABLE_TEMPLATE_VARIABLE_NAMESPACE) {
    return translatePickerText(translate, 'variables.picker.scopes.tableTemplate', 'Mẫu bảng');
  }

  if (tableName === DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE) {
    return translatePickerText(translate, 'variables.picker.scopes.documentTemplate', 'Mẫu nội dung');
  }

  return getVariableTableAlias(tableName);
};

const NUMBER_LIKE_FIELD_REGEX = /(hours|credit|credits|percentage|order|semester|duration|weight|count|level|total)$/i;
const FLAG_LIKE_FIELD_REGEX = /^(is[A-Z]|has[A-Z])|^(active|required|is_required)$/;

const buildFieldVariableMetadata = (
  tableName: string,
  fieldName: string,
  template_type?: string | null,
  translate?: TVariablePickerTranslate,
) => {
  const dynamicDefinition = getTemplateVariableDefinitionByKey(`${tableName}.${fieldName}`, template_type);

  if (
    dynamicDefinition?.variableType === 'TABLE_VARIABLE' &&
    getTemplateVariableTableTemplateByKey(`${tableName}.${fieldName}`, template_type)
  ) {
    return {
      dataKind: 'table' as const,
      dataLabel: translatePickerText(
        translate,
        'variables.picker.metadata.structuredTableVariable',
        'Biến bảng có cấu trúc',
      ),
      renderLabel: translatePickerText(translate, 'variables.picker.metadata.renderTableBlock', 'Hiển thị: Khối bảng'),
      renderHint: translatePickerText(
        translate,
        'variables.picker.metadata.tableVariableHint',
        'Chèn cả một bảng được cấu hình bằng JSON vào tài liệu.',
      ),
    };
  }

  if (isSelectVariableInputType(dynamicDefinition?.inputType) && dynamicDefinition?.dataSource?.type === 'table') {
    const sourceTable = dynamicDefinition.dataSource.table;
    const sourceField = dynamicDefinition.dataSource.valueField;
    return {
      dataKind: 'reference' as const,
      dataLabel: translatePickerText(
        translate,
        'variables.picker.metadata.sourceField',
        'Nguồn: {{table}} · {{field}}',
        {
          table: getVariableTableAlias(sourceTable),
          field: getVariableAlias(sourceTable, sourceField),
        },
      ),
      renderLabel: translatePickerText(
        translate,
        'variables.picker.metadata.renderSelectedValue',
        'Hiển thị: Giá trị đã chọn',
      ),
      renderHint: translatePickerText(
        translate,
        'variables.picker.metadata.selectedValueHint',
        'Chèn giá trị người dùng chọn từ nguồn dữ liệu đã cấu hình.',
      ),
    };
  }

  if (isCheckVariableInputType(dynamicDefinition?.inputType)) {
    return {
      dataKind: 'flag' as const,
      dataLabel: translatePickerText(translate, 'variables.picker.metadata.checkboxField', 'Trường checkbox'),
      renderLabel: translatePickerText(
        translate,
        'variables.picker.metadata.renderInlineValue',
        'Hiển thị: Giá trị nội tuyến',
      ),
      renderHint: translatePickerText(
        translate,
        'variables.picker.metadata.checkboxHint',
        'Chèn trạng thái có/không của checkbox vào trong dòng văn bản.',
      ),
    };
  }

  if (isNumberVariableInputType(dynamicDefinition?.inputType)) {
    return {
      dataKind: 'number' as const,
      dataLabel: translatePickerText(translate, 'variables.picker.metadata.numberField', 'Trường số'),
      renderLabel: translatePickerText(
        translate,
        'variables.picker.metadata.renderInlineValue',
        'Hiển thị: Giá trị nội tuyến',
      ),
      renderHint: translatePickerText(
        translate,
        'variables.picker.metadata.numberHint',
        'Chèn giá trị số vào trong dòng văn bản.',
      ),
    };
  }

  if (isImageVariableInputType(dynamicDefinition?.inputType)) {
    return {
      dataKind: 'document' as const,
      dataLabel: translatePickerText(translate, 'variables.picker.metadata.imageField', 'Trường ảnh URL/upload'),
      renderLabel: translatePickerText(translate, 'variables.picker.metadata.renderImageBlock', 'Hiển thị: Khối ảnh'),
      renderHint: translatePickerText(
        translate,
        'variables.picker.metadata.imageHint',
        'Chèn hình ảnh từ URL hoặc file upload vào tài liệu.',
      ),
    };
  }

  const foreignKeyMeta = getForeignKeyMeta()[`${tableName}.${fieldName}`];

  if (foreignKeyMeta) {
    return {
      dataKind: 'reference' as const,
      dataLabel: translatePickerText(
        translate,
        'variables.picker.metadata.referenceField',
        'Tham chiếu -> {{table}}.{{field}}',
        {
          table: getVariableTableAlias(foreignKeyMeta.table),
          field: foreignKeyMeta.display_field,
        },
      ),
      renderLabel: translatePickerText(
        translate,
        'variables.picker.metadata.renderInlineValue',
        'Hiển thị: Giá trị nội tuyến',
      ),
      renderHint: translatePickerText(
        translate,
        'variables.picker.metadata.referenceHint',
        'Chèn vào dòng văn bản và hiển thị giá trị tham chiếu từ {{table}}.',
        { table: getVariableTableAlias(foreignKeyMeta.table) },
      ),
    };
  }

  if (FLAG_LIKE_FIELD_REGEX.test(fieldName)) {
    return {
      dataKind: 'flag' as const,
      dataLabel: translatePickerText(translate, 'variables.picker.metadata.booleanLikeField', 'Trường dạng đúng/sai'),
      renderLabel: translatePickerText(
        translate,
        'variables.picker.metadata.renderInlineValue',
        'Hiển thị: Giá trị nội tuyến',
      ),
      renderHint: translatePickerText(
        translate,
        'variables.picker.metadata.singleValueHint',
        'Chèn vào dòng văn bản dưới dạng một giá trị đơn.',
      ),
    };
  }

  if (NUMBER_LIKE_FIELD_REGEX.test(fieldName)) {
    return {
      dataKind: 'number' as const,
      dataLabel: translatePickerText(translate, 'variables.picker.metadata.numberLikeField', 'Trường dạng số'),
      renderLabel: translatePickerText(
        translate,
        'variables.picker.metadata.renderInlineValue',
        'Hiển thị: Giá trị nội tuyến',
      ),
      renderHint: translatePickerText(
        translate,
        'variables.picker.metadata.numberLikeHint',
        'Chèn vào dòng văn bản dưới dạng số hoặc giá trị định lượng.',
      ),
    };
  }

  return {
    dataKind: 'text' as const,
    dataLabel: translatePickerText(translate, 'variables.picker.metadata.textField', 'Trường văn bản'),
    renderLabel: translatePickerText(
      translate,
      'variables.picker.metadata.renderInlineValue',
      'Hiển thị: Giá trị nội tuyến',
    ),
    renderHint: translatePickerText(
      translate,
      'variables.picker.metadata.textHint',
      'Chèn vào dòng văn bản dưới dạng một giá trị text đơn.',
    ),
  };
};

const buildFieldContextSentence = (
  tableName: string,
  fieldName: string,
  item: Pick<IVariablePickerItem, 'label' | 'dataKind'>,
  sampleValue: string,
  translate?: TVariablePickerTranslate,
) => {
  const label = item.label.toLowerCase();
  if (item.dataKind === 'number') {
    return translatePickerText(
      translate,
      'variables.picker.previewText.numberContext',
      'Chỉ số {{label}} được thể hiện trực tiếp trong nội dung là {{value}}.',
      { label, value: sampleValue },
    );
  }

  if (item.dataKind === 'reference') {
    return translatePickerText(
      translate,
      'variables.picker.previewText.referenceContext',
      'Thông tin {{label}} sẽ được hiển thị bằng giá trị tham chiếu {{value}} thay vì ID kỹ thuật.',
      { label, value: sampleValue },
    );
  }

  if (item.dataKind === 'flag') {
    return translatePickerText(
      translate,
      'variables.picker.previewText.flagContext',
      'Trạng thái {{label}} sẽ được hiển thị dưới dạng giá trị {{value}} trong câu văn.',
      { label, value: sampleValue },
    );
  }

  if (/code/i.test(fieldName)) {
    return translatePickerText(
      translate,
      'variables.picker.previewText.codeContext',
      'Mã hiển thị cho {{table}} sẽ xuất hiện là {{value}}.',
      { table: getVariableTableAlias(tableName).toLowerCase(), value: sampleValue },
    );
  }

  return translatePickerText(
    translate,
    'variables.picker.previewText.defaultContext',
    'Tại vị trí chèn, biến {{label}} sẽ được thay bằng giá trị {{value}} trong dòng văn bản thật.',
    { label, value: sampleValue },
  );
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const normalizeSampleKey = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

const getSampleValueForField = (
  tableName: string,
  fieldName: string,
  label: string,
  dataKind: TVariablePickerDataKind,
  translate?: TVariablePickerTranslate,
) => {
  const normalizedKey = normalizeSampleKey(`${tableName}${fieldName}${label}`);

  if (dataKind === 'reference') {
    if (normalizedKey.includes('major')) {
      return translatePickerText(translate, 'variables.picker.samples.major', 'Khoa học dữ liệu');
    }
    if (normalizedKey.includes('faculty')) {
      return translatePickerText(translate, 'variables.picker.samples.faculty', 'Khoa Công nghệ thông tin');
    }
    if (normalizedKey.includes('course')) {
      return translatePickerText(translate, 'variables.picker.samples.course', 'Phân tích dữ liệu');
    }
    if (normalizedKey.includes('plo')) return 'PLO1';
    if (normalizedKey.includes('po')) return 'PO2';
    return translatePickerText(translate, 'variables.picker.samples.generic', '{{label}} minh họa', { label });
  }

  if (dataKind === 'flag') {
    return translatePickerText(translate, 'variables.picker.samples.yes', 'Có');
  }

  if (dataKind === 'number') {
    if (normalizedKey.includes('credit')) return '3';
    if (normalizedKey.includes('hour')) return '45';
    if (normalizedKey.includes('duration')) {
      return translatePickerText(translate, 'variables.picker.samples.duration', '4 năm');
    }
    if (normalizedKey.includes('semester')) {
      return translatePickerText(translate, 'variables.picker.samples.semester', 'Học kỳ 5');
    }
    if (normalizedKey.includes('percentage')) return '70%';
    if (normalizedKey.includes('order')) return '2';
    return '120';
  }

  if (normalizedKey.includes('majorname') || normalizedKey.includes('major')) {
    return translatePickerText(translate, 'variables.picker.samples.major', 'Khoa học dữ liệu');
  }
  if (normalizedKey.includes('facultyname') || normalizedKey.includes('faculty')) {
    return translatePickerText(translate, 'variables.picker.samples.faculty', 'Khoa Công nghệ thông tin');
  }
  if (normalizedKey.includes('programname') || normalizedKey.includes('academicprogramname')) {
    return translatePickerText(
      translate,
      'variables.picker.samples.program',
      'Chương trình đào tạo ngành Khoa học dữ liệu',
    );
  }
  if (normalizedKey.includes('coursename') || normalizedKey.includes('course')) {
    return translatePickerText(translate, 'variables.picker.samples.course', 'Phân tích dữ liệu');
  }
  if (normalizedKey.includes('code')) return '7460108';
  if (normalizedKey.includes('email')) return 'example@gdu.edu.vn';
  if (normalizedKey.includes('phone')) return '0901234567';
  if (
    normalizedKey.includes('description') ||
    normalizedKey.includes('content') ||
    normalizedKey.includes('objective')
  ) {
    return translatePickerText(
      translate,
      'variables.picker.samples.longText',
      'Nội dung minh họa được điền đầy đủ để người dùng hình dung cách biến sẽ hiển thị sau khi kết xuất.',
    );
  }
  if (normalizedKey.includes('title')) {
    return translatePickerText(translate, 'variables.picker.samples.title', 'Tiêu đề minh họa');
  }

  return translatePickerText(translate, 'variables.picker.samples.generic', '{{label}} minh họa', { label });
};

const buildFieldPreviewHtml = (
  tableName: string,
  fieldName: string,
  item: IVariablePickerItem,
  translate?: TVariablePickerTranslate,
) => {
  const sampleValue = getSampleValueForField(tableName, fieldName, item.label, item.dataKind, translate);
  const contextSentence = buildFieldContextSentence(tableName, fieldName, item, sampleValue, translate);
  const introPrefix = translatePickerText(
    translate,
    'variables.picker.previewText.introPrefix',
    'Trường Đại học Gia Định triển khai chương trình đào tạo với định hướng ứng dụng cao. Trong phần nội dung này, biến',
  );
  const introSuffix = translatePickerText(
    translate,
    'variables.picker.previewText.introSuffix',
    'được chèn trực tiếp vào câu văn như sau:',
  );
  const beforeRenderLabel = translatePickerText(
    translate,
    'variables.picker.previewText.beforeRender',
    'Trước khi hiển thị',
  );
  const afterRenderLabel = translatePickerText(
    translate,
    'variables.picker.previewText.afterRender',
    'Sau khi hiển thị',
  );

  return `
    <div style="min-height: 100%; background: #eef2f7; padding: 12px;">
      <div style="width: 100%; background: white; border-radius: 18px; border: 1px solid #dbe3ef; box-shadow: 0 16px 38px rgba(15, 23, 42, 0.08); overflow: hidden;">
        <div style="padding: 22px;">
          <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 1.9; color: #0f172a;">
            ${escapeHtml(introPrefix)} <strong>${escapeHtml(item.label)}</strong> ${escapeHtml(introSuffix)}
          </p>

          <div style="margin: 0 0 22px 0; border-left: 4px solid #2563eb; background: #eff6ff; padding: 16px 18px; border-radius: 12px;">
            <p style="margin: 0; font-size: 15px; line-height: 1.9; color: #1e293b;">
              ${escapeHtml(contextSentence)}
            </p>
          </div>

          <div style="display: grid; gap: 14px;">
            <div style="border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; padding: 18px 20px;">
              <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8;">${escapeHtml(beforeRenderLabel)}</div>
              <p style="margin: 10px 0 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.8; color: #334155; word-break: break-word;">
                ${escapeHtml(item.token)}
              </p>
            </div>
            <div style="border: 1px solid #dbeafe; border-radius: 16px; background: linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%); padding: 18px 20px;">
              <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #2563eb;">${escapeHtml(afterRenderLabel)}</div>
              <p style="margin: 10px 0 0 0; font-size: 16px; line-height: 1.9; color: #0f172a;">
                ${escapeHtml(sampleValue)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

const collectDocumentPreviewValues = (
  sections: DocumentSection[],
  values: Record<string, string>,
  translate?: TVariablePickerTranslate,
) => {
  const applyFieldValue = (field: DocumentField, pathLabel: string) => {
    if (field.type === 'computed') {
      field.computed_from.forEach((ref, index) => {
        values[ref] = getSampleValueForField(
          pathLabel,
          `${field.id}${index}`,
          field.label || field.id,
          'number',
          translate,
        );
      });
      return;
    }

    if (field.type === 'checkbox') {
      field.options.forEach((option, index) => {
        option.checked = index === 0;
      });
      return;
    }

    if (field.type === 'list') {
      field.items.forEach((item, index) => {
        const itemKey = item.table_field || `${field.id}_${index}`;
        values[itemKey] = getSampleValueForField(
          pathLabel,
          itemKey,
          item.label || field.label || itemKey,
          'text',
          translate,
        );

        item.sub_items?.forEach((subItem, subIndex) => {
          const subKey = subItem.table_field || `${field.id}_${index}_sub_${subIndex}`;
          values[subKey] = getSampleValueForField(pathLabel, subKey, subItem.label || subKey, 'text', translate);
        });
      });
      return;
    }

    if (field.type === 'multi_reference_list') {
      values[field.id] = serializeDocumentMultiReferenceListValue([
        {
          value: 'sample-person-1',
          label: 'Lê Huỳnh Phước',
          record: {
            id: 'sample-person-1',
            name: 'Lê Huỳnh Phước',
            degree: 'Thạc sĩ',
            phones: ['0907 667 299'],
            emails: ['phuoclh@giadinh.edu.vn'],
          },
        },
      ]);
      return;
    }

    const key = field.table_field || field.id;
    values[key] = getSampleValueForField(
      pathLabel,
      key,
      field.label || key,
      field.type === 'number' ? 'number' : 'text',
      translate,
    );
  };

  const walk = (nodes: DocumentSection[], path: string) => {
    nodes.forEach((section) => {
      section.fields.forEach((field) => applyFieldValue(field, `${path}${section.title}`));

      if (section.children?.length) {
        walk(section.children, `${path}${section.title}.`);
      }
    });
  };

  walk(sections, '');
  return values;
};

const buildDocumentTemplatePreviewHtml = (template: DocumentTemplate, translate?: TVariablePickerTranslate) => {
  const previewValues = collectDocumentPreviewValues(template.sections || [], {}, translate);
  const renderedHtml = generateDocumentHtml(template, previewValues);

  return `
    <div style="min-height: 100%; background: #edf2f7; padding: 12px;">
      <div style="width: 100%; background: white; border-radius: 18px; border: 1px solid #dbe3ef; box-shadow: 0 16px 38px rgba(15, 23, 42, 0.1); overflow: hidden;">
        <div style="padding: 18px 22px; font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.7; font-size: 14px;">
          ${renderedHtml}
        </div>
      </div>
    </div>
  `;
};

const buildTableTemplatePreviewValues = (template: TableTemplate, translate?: TVariablePickerTranslate) => {
  const matches = JSON.stringify(template).match(/\{\{([^}]+)\}\}/g) ?? [];
  return matches.reduce<Record<string, string>>((acc, token) => {
    const normalizedToken = token.slice(2, -2);
    const [tableName, ...fieldParts] = normalizedToken.split('.');
    const fieldName = fieldParts.join('.');
    acc[token] = getSampleValueForField(
      tableName || template.id,
      fieldName || template.id,
      fieldName || template.name,
      'text',
      translate,
    );
    return acc;
  }, {});
};

const buildTableTemplatePreviewHtml = (template: TableTemplate, translate?: TVariablePickerTranslate) => {
  const previewValues = buildTableTemplatePreviewValues(template, translate);
  const renderedTableHtml = generateTableHtmlFromTableTemplate(template, previewValues);

  return `
    <div style="min-height: 100%; background: #edf2f7; padding: 12px;">
      <div style="width: 100%; background: white; border-radius: 18px; border: 1px solid #dbe3ef; box-shadow: 0 16px 38px rgba(15, 23, 42, 0.1); overflow: hidden;">
        <div style="padding: 16px;">
          ${renderedTableHtml}
        </div>
      </div>
    </div>
  `;
};

const buildVariableSearchText = (
  tableName: string,
  fieldName: string,
  token: string,
  label: string,
  template_type?: string | null,
) => {
  const scope = getVariableScope(tableName);
  const dynamicDefinition = getTemplateVariableDefinitionByKey(`${tableName}.${fieldName}`, template_type);
  const groupLabel = dynamicDefinition?.groupLabel || getVariableGroupLabel(tableName);
  const sourceTables = getTemplateVariableSourceTables(dynamicDefinition);
  const scopeLabel =
    scope === 'tableTemplate' ? 'table template' : scope === 'documentTemplate' ? 'document template' : 'field';

  return normalizeAliasSearchText(
    [
      token,
      `${tableName}.${fieldName}`,
      `${tableName} ${fieldName}`,
      tableName,
      fieldName,
      label,
      groupLabel,
      ...sourceTables,
      ...sourceTables.map((sourceTable) => getVariableTableAlias(sourceTable)),
      getVariableAlias(tableName, fieldName, template_type),
      scopeLabel,
    ].join(' '),
  );
};

const compareVariableItems = (left: IVariablePickerItem, right: IVariablePickerItem) => {
  const scopeOrderDiff = VARIABLE_SCOPE_ORDER[left.scope] - VARIABLE_SCOPE_ORDER[right.scope];
  if (scopeOrderDiff !== 0) return scopeOrderDiff;

  const groupCompare = left.groupLabel.localeCompare(right.groupLabel, 'vi', { sensitivity: 'base' });
  if (groupCompare !== 0) return groupCompare;

  return left.label.localeCompare(right.label, 'vi', { sensitivity: 'base' });
};

const getVariableSearchRank = (item: IVariablePickerItem, normalizedQuery: string) => {
  const normalizedLabel = normalizeAliasSearchText(item.label);
  const normalizedGroup = normalizeAliasSearchText(item.groupLabel);
  const normalizedToken = normalizeAliasSearchText(item.token);

  if (normalizedLabel === normalizedQuery) return 0;
  if (normalizedLabel.startsWith(normalizedQuery)) return 1;
  if (normalizedLabel.includes(normalizedQuery)) return 2;
  if (item.scope === 'field' && normalizedGroup.includes(normalizedQuery)) return 3;
  if (normalizedToken.includes(normalizedQuery)) return 4;
  if (normalizedGroup.includes(normalizedQuery)) return 5;
  return 6;
};

export const getVariablePickerItems = (
  queryText = '',
  catalog: ExactSchemaCatalog = getSchemaFieldCatalog(),
  options?: IVariablePickerOptions,
): IVariablePickerItem[] => {
  const normalizedQuery = normalizeAliasSearchText(queryText || '');
  const template_type = options?.template_type ?? null;
  const translate = options?.t;
  const catalogWithTemplates = getVariableCatalogWithTemplates(catalog, template_type);

  const items = Object.keys(catalogWithTemplates)
    .filter((tableName) => !HIDDEN_TABLES.includes(tableName))
    .flatMap((tableName) => {
      const blacklistedFields = MENTION_BLACKLIST[tableName] || [];

      return (catalogWithTemplates[tableName] || [])
        .filter((fieldName) => !blacklistedFields.includes(fieldName as string))
        .map((fieldName) => {
          const normalizedFieldName = fieldName as string;
          const token = `{{${tableName}.${normalizedFieldName}}}`;
          const scope = getVariableScope(tableName);
          const label = getVariableAlias(tableName, normalizedFieldName, template_type);
          const dynamicDefinition = getTemplateVariableDefinitionByKey(
            `${tableName}.${normalizedFieldName}`,
            template_type,
          );
          const groupLabel = dynamicDefinition?.groupLabel || getVariableGroupLabel(tableName, translate);
          const variableType: TVariableDefinitionType =
            scope === 'tableTemplate'
              ? 'TABLE_VARIABLE'
              : scope === 'documentTemplate'
                ? 'DOCUMENT_VARIABLE'
                : (dynamicDefinition?.variableType ?? 'FIELD_VARIABLE');
          const sourceTable =
            scope === 'field' ? (getTemplateVariableSourceTables(dynamicDefinition)[0] ?? tableName) : null;
          const sourceTableLabel = sourceTable ? getVariableTableAlias(sourceTable) : null;
          const fieldMetadata =
            scope === 'field'
              ? buildFieldVariableMetadata(tableName, normalizedFieldName, template_type, translate)
              : scope === 'tableTemplate'
                ? {
                    dataKind: 'table' as const,
                    dataLabel: translatePickerText(
                      translate,
                      'variables.picker.metadata.structuredTableTemplate',
                      'Mẫu bảng có cấu trúc',
                    ),
                    renderLabel: translatePickerText(
                      translate,
                      'variables.picker.metadata.renderTableBlock',
                      'Hiển thị: Khối bảng',
                    ),
                    renderHint: translatePickerText(
                      translate,
                      'variables.picker.metadata.tableTemplateHint',
                      'Chèn cả một khối bảng vào tài liệu, không chèn giữa câu.',
                    ),
                  }
                : {
                    dataKind: 'document' as const,
                    dataLabel: translatePickerText(
                      translate,
                      'variables.picker.metadata.structuredDocumentSection',
                      'Mẫu nội dung có cấu trúc',
                    ),
                    renderLabel: translatePickerText(
                      translate,
                      'variables.picker.metadata.renderSectionBlock',
                      'Hiển thị: Khối nội dung',
                    ),
                    renderHint: translatePickerText(
                      translate,
                      'variables.picker.metadata.documentTemplateHint',
                      'Chèn cả một khối nội dung/section vào tài liệu, không chèn giữa câu.',
                    ),
                  };

          const insertMode: TVariablePickerInsertMode =
            variableType === 'TABLE_VARIABLE' || variableType === 'DOCUMENT_VARIABLE' ? 'block' : 'inline';

          return {
            key: `${tableName}.${normalizedFieldName}`,
            token,
            label,
            groupKey: tableName,
            groupLabel,
            scope,
            variableType,
            sourceTable,
            sourceTableLabel,
            searchText: buildVariableSearchText(tableName, normalizedFieldName, token, label, template_type),
            subtitle:
              insertMode === 'inline'
                ? `${groupLabel} · ${token}`
                : `${
                    fieldMetadata.dataKind === 'table'
                      ? translatePickerText(translate, 'variables.picker.metadata.tableBlock', 'Khối bảng')
                      : scope === 'tableTemplate'
                        ? translatePickerText(translate, 'variables.picker.metadata.blockVariable', 'Biến dạng khối')
                        : translatePickerText(translate, 'variables.picker.metadata.documentBlock', 'Khối nội dung')
                  } · ${token}`,
            insertMode,
            dataKind: fieldMetadata.dataKind,
            dataLabel: fieldMetadata.dataLabel,
            renderLabel: fieldMetadata.renderLabel,
            renderHint: fieldMetadata.renderHint,
          } satisfies IVariablePickerItem;
        });
    })
    .sort(compareVariableItems);

  if (!normalizedQuery) {
    return items;
  }

  return items
    .filter((item) => item.searchText.includes(normalizedQuery))
    .sort((left, right) => {
      const rankDiff = getVariableSearchRank(left, normalizedQuery) - getVariableSearchRank(right, normalizedQuery);
      if (rankDiff !== 0) return rankDiff;
      return compareVariableItems(left, right);
    });
};

export const insertVariablePickerItem = (
  editor: ClassicEditor,
  item: Pick<IVariablePickerItem, 'insertMode' | 'token'>,
  selectionRange?: ModelRange | null,
) => {
  insertVariablePickerItems(editor, [item], selectionRange);
};

export const insertVariablePickerItems = (
  editor: ClassicEditor,
  items: Array<Pick<IVariablePickerItem, 'insertMode' | 'token'>>,
  selectionRange?: ModelRange | null,
) => {
  if (items.length === 0) {
    return;
  }

  const html = items
    .map((item, index) => {
      const mentionHtml = `<span class="mention" data-mention="${escapeHtml(item.token)}">${escapeHtml(item.token)}</span>`;
      if (item.insertMode === 'block') {
        return `<p>${mentionHtml}</p>`;
      }

      return `${mentionHtml}${items[index + 1]?.insertMode === 'inline' ? ' ' : ''}`;
    })
    .join('');
  const viewFragment = editor.data.processor.toView(html);
  const modelFragment = editor.data.toModel(viewFragment);

  editor.model.change((writer) => {
    if (selectionRange) {
      writer.setSelection(selectionRange);
    }

    editor.model.insertContent(modelFragment, editor.model.document.selection);
  });

  editor.editing.view.focus();
};

export const getVariablePickerPreviewHtml = (
  item: IVariablePickerItem,
  translate?: TVariablePickerTranslate,
): string => {
  const [tableName, ...fieldParts] = item.key.split('.');
  const fieldName = fieldParts.join('.');
  const dynamicTableTemplate = getTemplateVariableTableTemplateByKey(item.key);

  if (dynamicTableTemplate) {
    return buildTableTemplatePreviewHtml(dynamicTableTemplate, translate);
  }

  if (item.scope === 'tableTemplate') {
    const template = getTableTemplateById(fieldName);
    if (template) {
      return buildTableTemplatePreviewHtml(template, translate);
    }
  }

  if (item.variableType === 'TABLE_VARIABLE') {
    const template = getTemplateVariableTableTemplateByKey(item.key);
    if (template) {
      return buildTableTemplatePreviewHtml(template, translate);
    }
  }

  if (item.scope === 'documentTemplate') {
    const template = getDocumentTemplateById(fieldName);
    if (template) {
      return buildDocumentTemplatePreviewHtml(template, translate);
    }
  }

  return buildFieldPreviewHtml(tableName, fieldName, item, translate);
};
