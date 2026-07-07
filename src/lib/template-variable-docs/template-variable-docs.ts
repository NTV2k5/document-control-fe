export type TTemplateVariableDocCategoryId = 'table-variable-config';

export type TTemplateVariableDocCategory = {
  id: TTemplateVariableDocCategoryId;
  label: string;
  description: string;
  order: number;
};

export type TTemplateVariableDocConfig = {
  id: string;
  categoryId: TTemplateVariableDocCategoryId;
  badge: string;
  title: string;
  description: string;
  url: string;
  order: number;
  tags: string[];
};

export const TEMPLATE_VARIABLE_DOC_CATEGORIES: TTemplateVariableDocCategory[] = [
  {
    id: 'table-variable-config',
    label: 'Cấu hình biến bảng',
    description: 'Rule, context schema, table structure và cách render table variable.',
    order: 10,
  },
];

export const TEMPLATE_VARIABLE_DOCS: TTemplateVariableDocConfig[] = [
  {
    id: 'table-rule-guide',
    categoryId: 'table-variable-config',
    badge: 'Docs cấu hình biến mẫu',
    title: 'Template Variable Table Rule Guide',
    description: 'Tài liệu map rule, context schema, table structure và cách render biến bảng.',
    url: '/docs/template-variable-table-rule-guide.html',
    order: 10,
    tags: ['table variable', 'render rule', 'context schema'],
  },
];

export const getTemplateVariableDocById = (docId: string) =>
  TEMPLATE_VARIABLE_DOCS.find((doc) => doc.id === docId) ?? null;

export const getTemplateVariableDocHref = (docId: string) => `/template-variable-docs/${docId}`;

export const getTemplateVariableDocsByCategory = () =>
  [...TEMPLATE_VARIABLE_DOC_CATEGORIES]
    .sort((first, second) => first.order - second.order)
    .map((category) => ({
      ...category,
      docs: TEMPLATE_VARIABLE_DOCS.filter((doc) => doc.categoryId === category.id).sort(
        (first, second) => first.order - second.order,
      ),
    }));
