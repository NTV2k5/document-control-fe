import {
  DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
  getDocumentTemplateById,
  type DocumentTemplate,
} from '../document-templates';
import { getTableTemplateById, TABLE_TEMPLATE_VARIABLE_NAMESPACE } from '../table-templates';
import { getTemplateVariableDefinitionByKey, getTemplateVariableDocumentTemplateByKey } from '../template-data';
import { parseVariableName } from '../variables';

const TABLE_ALIASES: Record<string, string> = {
  academic_cohorts: 'Khóa Tuyển Sinh',
  academic_program_blocks: 'Khối Kiến Thức CTĐT',
  academic_program_courses: 'Học Phần CTĐT',
  academic_programs: 'Chương Trình Đào Tạo',
  assessment_clos: 'CLO Đánh Giá',
  assessment_schemes: 'Hình Thức Đánh Giá',
  courses: 'Học Phần',
  faculties: 'Khoa',
  curriculum_blocks: 'Khối Kiến Thức',
  major: 'Ngành',
  majors: 'Ngành',
  clo_plo_matrix: 'Ma Trận CLO PLO',
  course_plo_matrix: 'Ma Trận Học Phần PLO',
  plos: 'PLO',
  plo_categories: 'Nhóm PLO',
  po_categories: 'Nhóm PO',
  pos: 'PO',
  specializations: 'Chuyên Ngành',
  syllabuses: 'Đề Cương',
  syllabus_clos: 'CLO Đề Cương',
  teaching_plans: 'Kế Hoạch Giảng Dạy',
};

const FIELD_ALIASES: Record<string, string> = {
  _creationTime: 'Thời Gian Tạo',
  _id: 'ID',
  academic_cohort: 'Khóa Tuyển Sinh',
  academic_cohort_id: 'Khóa Tuyển Sinh',
  academic_code: 'Mã CTĐT',
  academic_program_id: 'Chương Trình Đào Tạo',
  active: 'Kích Hoạt',
  assessment_method: 'Phương Pháp Đánh Giá',
  bloom_level: 'Mức Bloom',
  cloId: 'CLO',
  code: 'Mã',
  component: 'Thành Phần',
  content: 'Nội Dung',
  course_id: 'Học Phần',
  credits: 'Số Tín Chỉ',
  description: 'Mô Tả',
  education_system: 'Hệ Đào Tạo',
  english_name: 'Tên Tiếng Anh',
  faculty_id: 'Khoa',
  hours: 'Số Giờ',
  integrated_hours: 'Giờ Tích Hợp',
  is_required: 'Bắt Buộc/Tự Chọn',
  curriculum_block_id: 'Khối Kiến Thức',
  major_id: 'Ngành',
  name: 'Tên',
  objective: 'Mục Tiêu',
  optional_explain: 'Ghi Chú Tự Chọn',
  optional_practise_credit: 'Số Tín Chỉ Thực Hành Tự Chọn',
  optional_theory_credit: 'Số Tín Chỉ Lý Thuyết Tự Chọn',
  optional_total_credit: 'Tổng Số Tín Chỉ Tự Chọn',
  order: 'Thứ Tự',
  parent_id: 'Mục Cha',
  percentage: 'Tỷ Lệ',
  plo_category_id: 'Nhóm PLO',
  plo_id: 'PLO',
  po_category_id: 'Nhóm PO',
  practise_credit: 'Số Tín Chỉ Thực Hành',
  practice_hours: 'Giờ Thực Hành',
  preceding_course_id: 'Học Phần Học Trước',
  prerequisiteCourseId: 'Học Phần Tiên Quyết',
  required_practise_credit: 'Số Tín Chỉ Thực Hành Bắt Buộc',
  required_theory_credit: 'Số Tín Chỉ Lý Thuyết Bắt Buộc',
  required_total_credit: 'Tổng Số Tín Chỉ Bắt Buộc',
  semester: 'Học Kỳ',
  sign_location_date: 'Ngày Tháng Năm, Địa Điểm Ký',
  specialization_id: 'Chuyên Ngành',
  status: 'Trạng Thái',
  syllabus_id: 'Đề Cương',
  title: 'Tiêu Đề',
  total_hours: 'Tổng Số Giờ',
  total_credit: 'Tổng Số Tín Chỉ',
  training_duration: 'Thời Gian Đào Tạo',
  theory_credit: 'Số Tín Chỉ Lý Thuyết',
  theory_hours: 'Giờ Lý Thuyết',
  type: 'Loại',
  updated_at: 'Ngày Cập Nhật',
};

const TABLE_FIELD_ALIASES: Record<string, string> = {
  'academic_programs.code': 'Mã CTĐT',
  'academic_programs.name': 'Tên CTĐT',
  'academic_programs.academic_cohort': 'Khóa Tuyển Sinh',
  'academic_programs.academic_cohort_id': 'Khóa Tuyển Sinh',
  'academic_programs.english_name': 'Tên Chương Trình Đào Tạo (Tiếng Anh)',
  'academic_programs.major_id': 'Ngành',
  'academic_programs.objective': 'Mục Tiêu CTĐT',
  'academic_cohorts.code': 'Mã Khóa Tuyển Sinh',
  'academic_cohorts.name': 'Tên Khóa Tuyển Sinh',
  'courses.code': 'Mã Học Phần',
  'courses.name': 'Tên Học Phần',
  'courses.english_name': 'Tên Học Phần (Tiếng Anh)',
  'courses.preceding_course_id': 'Học Phần Học Trước',
  'courses.prerequisiteCourseId': 'Học Phần Tiên Quyết',
  'faculties.code': 'Mã Khoa',
  'faculties.name': 'Tên Khoa',
  'major.code': 'Mã Ngành',
  'major.name': 'Tên Ngành',
  'majors.code': 'Mã Ngành',
  'majors.name': 'Tên Ngành',
  'plos.code': 'Mã PLO',
  'plos.description': 'Mô Tả PLO',
  'pos.code': 'Mã PO',
  'pos.description': 'Mô Tả PO',
  'specializations.code': 'Mã Chuyên Ngành',
  'specializations.name': 'Tên Chuyên Ngành',
  'syllabuses.code': 'Mã Đề Cương',
  'syllabuses.name': 'Tên Đề Cương',
};

const TABLE_TEMPLATE_VARIABLE_ALIASES: Record<string, string> = {
  appendix_curriculum_comparison_matrix: 'PL-2.3.1 Bảng đối sánh nội dung CTĐT',
  course_plo_contribution_matrix: 'Bảng ma trận đóng góp học phần PLO',
  curriculum_framework_fixed: 'Bảng khung CTĐT cố định theo nhóm kiến thức',
  curriculum: 'Bảng cấu trúc CTĐT/học phần linh hoạt',
  knowledge_block_credit_summary: 'Bảng tổng kết tín chỉ khối kiến thức',
  objective_comparison_matrix: 'Bảng đối sánh mục tiêu CTĐT',
  plo_bloom_level: 'Bảng chuẩn đầu ra chương trình đào tạo (PLO)',
  plo_comparison_matrix: 'Bảng đối sánh chuẩn đầu ra (PLO)',
  plo_matrix: 'Bảng ma trận chuẩn đầu ra chương trình đào tạo',
  po_objectives: 'Bảng mục tiêu chương trình đào tạo (PO)',
  po_plo_matrix: 'Bảng ma trận quan hệ PO-PLO',
  program_general_info: 'Bảng thông tin chung chương trình đào tạo',
  semester_courses: 'Bảng kế hoạch học phần theo học kỳ',
  'syllabus.assessment_rubric': 'Bảng 8.3 tiêu chí đánh giá đồ án',
  syllabus_content: 'Bảng nội dung đề cương và liên kết CLO',
  syllabus_clo_mapping: 'Bảng chuẩn đầu ra học phần (CLO)',
  syllabus_clo_plo_matrix: 'Bảng mục 5 - Ma trận CLO-PLO',
  assessment_method_plo_matrix: 'Bảng ma trận AM-PLO',
  teaching_learning_method_plo_matrix: 'Bảng ma trận TLM-PLO',
  teaching_plan: 'Bảng kế hoạch giảng dạy',
  teaching_schedule: 'Bảng lịch trình giảng dạy và hoạt động',
};

const GENERIC_DOCUMENT_TEMPLATE_ALIASES = new Set([
  'mau noi dung',
  'mau noi dung moi',
  'document template',
  'content template',
]);

const IDENTIFIER_TOKEN_ALIASES: Record<string, string> = {
  academic: 'Học Thuật',
  assessment: 'Đánh Giá',
  block: 'Khối',
  category: 'Nhóm',
  clos: 'CLO',
  code: 'Mã',
  cohort: 'Khóa',
  component: 'Thành Phần',
  content: 'Nội Dung',
  course: 'Học Phần',
  created: 'Tạo',
  credit: 'Tín Chỉ',
  credits: 'Tín Chỉ',
  description: 'Mô Tả',
  duration: 'Thời Gian',
  education: 'Đào Tạo',
  english: 'Tiếng Anh',
  faculty: 'Khoa',
  field: 'Trường',
  hours: 'Giờ',
  knowledge: 'Kiến Thức',
  major: 'Ngành',
  method: 'Phương Pháp',
  name: 'Tên',
  objective: 'Mục Tiêu',
  optional: 'Tự Chọn',
  practise: 'Thực Hành',
  practice: 'Thực Hành',
  preceding: 'Học Trước',
  prerequisite: 'Tiên Quyết',
  program: 'Chương Trình',
  required: 'Bắt Buộc',
  scheme: 'Hình Thức',
  specialization: 'Chuyên Ngành',
  system: 'Hệ',
  theory: 'Lý Thuyết',
  title: 'Tiêu Đề',
  total: 'Tổng',
  training: 'Đào Tạo',
  updated: 'Cập Nhật',
  weight: 'Trọng Số',
};

export function normalizeAliasSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function isGenericDocumentTemplateAlias(value?: string | null): boolean {
  if (!value?.trim()) return true;

  const normalized = normalizeAliasSearchText(value.replace(/^[^\p{L}\p{N}]+/gu, ''));
  return GENERIC_DOCUMENT_TEMPLATE_ALIASES.has(normalized);
}

export function getDocumentTemplateDisplayAlias(template?: DocumentTemplate | null): string | undefined {
  return [template?.title, template?.name, template?.description]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length > 0 && !isGenericDocumentTemplateAlias(value));
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 1 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toUpperCase()))
    .join(' ');
}

function humanizeIdentifier(identifier: string): string {
  const fallback = identifier
    .replace(/Id$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
  return fallback
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => IDENTIFIER_TOKEN_ALIASES[token] || toTitleCase(token))
    .join(' ');
}

export function getVariableTableAlias(table: string): string {
  return TABLE_ALIASES[table] || humanizeIdentifier(table);
}

export function getVariableAlias(table: string, field: string, template_type?: string | null): string {
  const varKey = `${table}.${field}`;
  const dynamicDefinition = getTemplateVariableDefinitionByKey(varKey, template_type);

  if (table === TABLE_TEMPLATE_VARIABLE_NAMESPACE) {
    if (dynamicDefinition?.label) {
      return dynamicDefinition.label;
    }

    const templateAlias = TABLE_TEMPLATE_VARIABLE_ALIASES[field];
    if (templateAlias) return templateAlias;

    const template = getTableTemplateById(field);
    return template?.title || template?.name || template?.description || 'Mẫu Bảng';
  }

  if (table === DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE) {
    const template = getTemplateVariableDocumentTemplateByKey(varKey, template_type) ?? getDocumentTemplateById(field);
    const templateAlias = getDocumentTemplateDisplayAlias(template);
    if (templateAlias) return templateAlias;

    if (dynamicDefinition?.label && !isGenericDocumentTemplateAlias(dynamicDefinition.label)) {
      return dynamicDefinition.label;
    }

    return humanizeIdentifier(field.replace(/\./g, '_')) || 'Mẫu nội dung';
  }

  if (dynamicDefinition?.label) {
    return dynamicDefinition.label;
  }

  const tableFieldAlias = TABLE_FIELD_ALIASES[`${table}.${field}`];
  if (tableFieldAlias) return tableFieldAlias;

  const fieldAlias = FIELD_ALIASES[field] || humanizeIdentifier(field);
  if (fieldAlias === 'Mã' || fieldAlias === 'Tên') {
    return `${fieldAlias} ${getVariableTableAlias(table)}`;
  }
  return fieldAlias;
}

export function getVariableDisplayLabelFromParts(table: string, field: string, template_type?: string | null): string {
  return getVariableAlias(table, field, template_type);
}

export function getVariableDisplayLabel(varKey: string, template_type?: string | null): string {
  const parsed = parseVariableName(varKey);
  if (!parsed) return varKey;
  return getVariableDisplayLabelFromParts(parsed.table, parsed.field, template_type);
}
