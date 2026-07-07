export type TMentionEntityVisibility = 'primary' | 'secondary' | 'system';

export interface IMentionEntityConfig {
  key: string;
  table: string;
  label: string;
  aliases: string[];
  valueField: string;
  labelField?: string;
  searchFields: string[];
  insertTemplate: string;
  tokenTemplate: string;
  visibility: TMentionEntityVisibility;
  description?: string;
}

export const MENTION_ENTITY_REGISTRY = [
  {
    key: 'person',
    table: 'persons',
    label: 'Nhân sự / giảng viên',
    aliases: ['person', 'persons', 'persion', 'user', 'nguoi', 'nhansu', 'giangvien', 'gv', 'tacgia'],
    valueField: 'name',
    labelField: 'code',
    searchFields: ['name', 'code', 'emails', 'phones', 'degree', 'academic_rank', 'position'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{person:{{id}}:name}}',
    visibility: 'primary',
    description: 'Giảng viên, tác giả, người phụ trách học phần.',
  },
  {
    key: 'faculty',
    table: 'faculties',
    label: 'Khoa',
    aliases: ['faculty', 'faculties', 'khoa', 'donvikhoa'],
    valueField: 'name',
    labelField: 'code',
    searchFields: ['name', 'code'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{faculty:{{id}}:name}}',
    visibility: 'primary',
  },
  {
    key: 'major',
    table: 'majors',
    label: 'Ngành',
    aliases: ['major', 'majors', 'nganh', 'nganhhoc'],
    valueField: 'name',
    labelField: 'code',
    searchFields: ['name', 'code'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{major:{{id}}:name}}',
    visibility: 'primary',
  },
  {
    key: 'specialization',
    table: 'specializations',
    label: 'Chuyên ngành',
    aliases: ['specialization', 'specializations', 'chuyennganh', 'chuyen-nganh'],
    valueField: 'name',
    labelField: 'code',
    searchFields: ['name', 'code'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{specialization:{{id}}:name}}',
    visibility: 'primary',
  },
  {
    key: 'course',
    table: 'courses',
    label: 'Học phần',
    aliases: ['course', 'courses', 'monhoc', 'hocphan', 'mon', 'hp'],
    valueField: 'name',
    labelField: 'code',
    searchFields: ['name', 'code', 'english_name', 'description'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{course:{{id}}:name}}',
    visibility: 'primary',
  },
  {
    key: 'academic_program',
    table: 'academic_programs',
    label: 'Chương trình đào tạo',
    aliases: ['academicprogram', 'academic_program', 'program', 'ctdt', 'chuongtrinh', 'chuongtrinhdaotao'],
    valueField: 'name',
    labelField: 'academic_code',
    searchFields: ['name', 'english_name', 'academic_code', 'education_system'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{academic_program:{{id}}:name}}',
    visibility: 'primary',
  },
  {
    key: 'academic_cohort',
    table: 'academic_cohorts',
    label: 'Khóa học / cohort',
    aliases: ['academiccohort', 'academic_cohort', 'cohort', 'khoahoc', 'nienkhoa'],
    valueField: 'name',
    labelField: 'code',
    searchFields: ['name', 'code', 'admission_year', 'expected_graduation_year'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{academic_cohort:{{id}}:name}}',
    visibility: 'primary',
  },
  {
    key: 'curriculum_block',
    table: 'curriculum_blocks',
    label: 'Khối kiến thức',
    aliases: ['curriculumblock', 'curriculum_block', 'khoikienthuc', 'khoi', 'block'],
    valueField: 'name',
    labelField: 'prefix',
    searchFields: ['name', 'prefix'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{curriculum_block:{{id}}:name}}',
    visibility: 'primary',
  },
  {
    key: 'syllabus',
    table: 'syllabuses',
    label: 'Đề cương học phần',
    aliases: ['syllabus', 'syllabuses', 'decuong', 'decuonghocphan'],
    valueField: 'name',
    labelField: 'version',
    searchFields: ['name', 'description', 'version'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{syllabus:{{id}}:name}}',
    visibility: 'primary',
  },
  {
    key: 'syllabus_clo',
    table: 'syllabus_clos',
    label: 'CLO học phần',
    aliases: ['syllabusclo', 'syllabus_clo', 'clo', 'clohocphan', 'cdrhocphan'],
    valueField: 'code',
    labelField: 'description',
    searchFields: ['code', 'description', 'expected_level'],
    insertTemplate: '{{code}}',
    tokenTemplate: '{{syllabus_clo:{{id}}:code}}',
    visibility: 'primary',
  },
  {
    key: 'plo',
    table: 'plos',
    label: 'PLO',
    aliases: ['plo', 'plos', 'cdrctdt', 'chuan-dau-ra-ctdt'],
    valueField: 'code',
    labelField: 'description',
    searchFields: ['code', 'description', 'bloom_level'],
    insertTemplate: '{{code}}',
    tokenTemplate: '{{plo:{{id}}:code}}',
    visibility: 'primary',
  },
  {
    key: 'po',
    table: 'pos',
    label: 'PO',
    aliases: ['po', 'pos', 'muctieu', 'muctieuctdt'],
    valueField: 'name',
    labelField: 'description',
    searchFields: ['name', 'description'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{po:{{id}}:name}}',
    visibility: 'primary',
  },
  {
    key: 'syllabus_reference',
    table: 'syllabus_references',
    label: 'Tài liệu tham khảo',
    aliases: ['reference', 'references', 'tailieu', 'tailieuthamkhao', 'giaotrinh', 'sach'],
    valueField: 'title',
    labelField: 'author',
    searchFields: ['title', 'author', 'year', 'type'],
    insertTemplate: '{{author}} ({{year}}), {{title}}',
    tokenTemplate: '{{syllabus_reference:{{id}}:title}}',
    visibility: 'primary',
  },
  {
    key: 'teaching_plan',
    table: 'teaching_plans',
    label: 'Kế hoạch giảng dạy',
    aliases: ['teachingplan', 'teaching_plan', 'kehoach', 'kehoachgiangday', 'buoihoc'],
    valueField: 'title',
    labelField: 'session_no',
    searchFields: ['session_no', 'title', 'content', 'teaching_method', 'student_task', 'assessment_method'],
    insertTemplate: '{{title}}',
    tokenTemplate: '{{teaching_plan:{{id}}:title}}',
    visibility: 'secondary',
  },
  {
    key: 'assessment_scheme',
    table: 'assessment_schemes',
    label: 'Thành phần đánh giá',
    aliases: ['assessment', 'assessment_scheme', 'danhgia', 'thanhphandanhgia'],
    valueField: 'component',
    labelField: 'weight',
    searchFields: ['component', 'weight', 'description'],
    insertTemplate: '{{component}}',
    tokenTemplate: '{{assessment_scheme:{{id}}:component}}',
    visibility: 'secondary',
  },
  {
    key: 'plo_category',
    table: 'plo_categories',
    label: 'Nhóm PLO',
    aliases: ['plocategory', 'plo_category', 'nhomplo'],
    valueField: 'name',
    labelField: 'description',
    searchFields: ['name', 'description'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{plo_category:{{id}}:name}}',
    visibility: 'secondary',
  },
  {
    key: 'po_category',
    table: 'po_categories',
    label: 'Nhóm PO',
    aliases: ['pocategory', 'po_category', 'nhompo'],
    valueField: 'name',
    labelField: 'description',
    searchFields: ['name', 'description'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{po_category:{{id}}:name}}',
    visibility: 'secondary',
  },
  {
    key: 'academic_program_course',
    table: 'academic_program_courses',
    label: 'Học phần trong CTĐT',
    aliases: ['academicprogramcourse', 'academic_program_course', 'hocphanctdt', 'monhocctdt'],
    valueField: 'course_id',
    labelField: 'total_credit',
    searchFields: ['course_id', 'total_credit', 'theory_credit', 'practise_credit', 'is_required'],
    insertTemplate: '{{course_id}}',
    tokenTemplate: '{{academic_program_course:{{id}}:course_id}}',
    visibility: 'secondary',
  },
  {
    key: 'academic_program_block',
    table: 'academic_program_blocks',
    label: 'Khối kiến thức trong CTĐT',
    aliases: ['academicprogramblock', 'academic_program_block', 'khoictdt', 'khoikienthucctdt'],
    valueField: 'curriculum_block_id',
    labelField: 'total_credit',
    searchFields: ['curriculum_block_id', 'total_credit', 'required_total_credit', 'optional_total_credit'],
    insertTemplate: '{{curriculum_block_id}}',
    tokenTemplate: '{{academic_program_block:{{id}}:curriculum_block_id}}',
    visibility: 'secondary',
  },
  {
    key: 'course_plo_matrix',
    table: 'course_plo_matrix',
    label: 'Ma trận học phần - PLO',
    aliases: ['courseplomatrix', 'course_plo_matrix', 'matranhocphanplo'],
    valueField: 'course_id',
    labelField: 'plo_id',
    searchFields: ['course_id', 'plo_id'],
    insertTemplate: '{{course_id}}',
    tokenTemplate: '{{course_plo_matrix:{{id}}:course_id}}',
    visibility: 'secondary',
  },
  {
    key: 'clo_plo_matrix',
    table: 'clo_plo_matrix',
    label: 'Ma trận CLO - PLO',
    aliases: ['cloplomatrix', 'clo_plo_matrix', 'matrancloplo'],
    valueField: 'syllabus_clo_id',
    labelField: 'plo_id',
    searchFields: ['syllabus_clo_id', 'plo_id', 'contribution_level'],
    insertTemplate: '{{syllabus_clo_id}}',
    tokenTemplate: '{{clo_plo_matrix:{{id}}:syllabus_clo_id}}',
    visibility: 'secondary',
  },
  {
    key: 'assessment_clo',
    table: 'assessment_clos',
    label: 'Đánh giá - CLO',
    aliases: ['assessmentclo', 'assessment_clo', 'danhgiaclo'],
    valueField: 'assessment_scheme_id',
    labelField: 'syllabus_clo_id',
    searchFields: ['assessment_scheme_id', 'syllabus_clo_id'],
    insertTemplate: '{{assessment_scheme_id}}',
    tokenTemplate: '{{assessment_clo:{{id}}:assessment_scheme_id}}',
    visibility: 'secondary',
  },
  {
    key: 'template',
    table: 'templates',
    label: 'Mẫu tài liệu',
    aliases: ['template', 'templates', 'mau', 'mautailieu'],
    valueField: 'name',
    labelField: 'status',
    searchFields: ['name', 'description', 'status', 'source_file_name'],
    insertTemplate: '{{name}}',
    tokenTemplate: '{{template:{{id}}:name}}',
    visibility: 'system',
  },
  {
    key: 'document',
    table: 'documents',
    label: 'Tài liệu',
    aliases: ['document', 'documents', 'tailieuhethong', 'vanban'],
    valueField: 'title',
    labelField: 'status',
    searchFields: ['title', 'description', 'status'],
    insertTemplate: '{{title}}',
    tokenTemplate: '{{document:{{id}}:title}}',
    visibility: 'system',
  },
  {
    key: 'template_revision',
    table: 'template_revisions',
    label: 'Phiên bản mẫu',
    aliases: ['templaterevision', 'template_revision', 'revisionmau'],
    valueField: 'summary',
    labelField: 'action',
    searchFields: ['summary', 'action', 'updated_by'],
    insertTemplate: '{{summary}}',
    tokenTemplate: '{{template_revision:{{id}}:summary}}',
    visibility: 'system',
  },
  {
    key: 'document_revision',
    table: 'document_revisions',
    label: 'Phiên bản tài liệu',
    aliases: ['documentrevision', 'document_revision', 'revisiontailieu'],
    valueField: 'summary',
    labelField: 'action',
    searchFields: ['summary', 'action', 'updated_by'],
    insertTemplate: '{{summary}}',
    tokenTemplate: '{{document_revision:{{id}}:summary}}',
    visibility: 'system',
  },
  {
    key: 'template_audit_log',
    table: 'template_audit_logs',
    label: 'Lịch sử mẫu',
    aliases: ['templateauditlog', 'template_audit_log', 'auditmau'],
    valueField: 'action',
    labelField: 'performed_by',
    searchFields: ['action', 'performed_by', 'previous_status', 'new_status'],
    insertTemplate: '{{action}}',
    tokenTemplate: '{{template_audit_log:{{id}}:action}}',
    visibility: 'system',
  },
  {
    key: 'document_audit_log',
    table: 'document_audit_logs',
    label: 'Lịch sử tài liệu',
    aliases: ['documentauditlog', 'document_audit_log', 'audittailieu'],
    valueField: 'action',
    labelField: 'performed_by',
    searchFields: ['action', 'performed_by', 'previous_status', 'new_status'],
    insertTemplate: '{{action}}',
    tokenTemplate: '{{document_audit_log:{{id}}:action}}',
    visibility: 'system',
  },
] as const satisfies readonly IMentionEntityConfig[];

export type TMentionEntityKey = (typeof MENTION_ENTITY_REGISTRY)[number]['key'];
export type TMentionEntityTable = (typeof MENTION_ENTITY_REGISTRY)[number]['table'];
export type TMentionEntityConfig = (typeof MENTION_ENTITY_REGISTRY)[number];
export type TMentionRecordOption = {
  id: string;
  value: string;
  label: string;
  record?: Record<string, unknown>;
};

const normalizeMentionKeyword = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .replace(/[\s_-]+/g, '')
    .trim()
    .toLowerCase();

const isMentionRecordValueEmpty = (value: unknown) => value === null || value === undefined || value === '';

export const toMentionRecordText = (value: unknown): string => {
  if (isMentionRecordValueEmpty(value)) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map(toMentionRecordText).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return toMentionRecordText(objectValue.name ?? objectValue.title ?? objectValue.code ?? objectValue.id ?? '');
  }

  return String(value);
};

export const readMentionRecordOptionValue = (option: TMentionRecordOption, fieldName: string) => {
  const record = option.record ?? {};
  const fallbackRecord = {
    id: option.id,
    label: option.label,
    value: option.value,
    _id: option.id,
  };

  return record[fieldName] ?? fallbackRecord[fieldName as keyof typeof fallbackRecord];
};

export const renderMentionEntityTemplate = (template: string, option: TMentionRecordOption) => {
  const rendered = template.replace(/\{\{([^{}]+)}}/g, (_, fieldName: string) =>
    toMentionRecordText(readMentionRecordOptionValue(option, fieldName.trim())),
  );

  return rendered
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

export const getMentionRecordInsertText = (entity: IMentionEntityConfig, option: TMentionRecordOption) =>
  renderMentionEntityTemplate(entity.insertTemplate, option) || option.value || option.label;

export const formatMentionRecordOptionLabel = (entity: IMentionEntityConfig, option: TMentionRecordOption) => {
  const valueText = toMentionRecordText(readMentionRecordOptionValue(option, entity.valueField)) || option.value;
  const labelText = entity.labelField
    ? toMentionRecordText(readMentionRecordOptionValue(option, entity.labelField))
    : '';

  if (labelText && valueText && normalizeMentionKeyword(labelText) !== normalizeMentionKeyword(valueText)) {
    return `${valueText} - ${labelText}`;
  }

  return valueText || labelText || option.label || option.value;
};

export const getMentionRecordDetailText = (entity: IMentionEntityConfig, option: TMentionRecordOption) => {
  const formattedLabel = formatMentionRecordOptionLabel(entity, option);
  const apiLabel = option.label && option.label !== formattedLabel ? option.label : '';
  return [apiLabel, entity.label].filter(Boolean).join(' · ');
};

export const dedupeMentionRecordOptions = <TOption extends TMentionRecordOption>(items: TOption[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.id || item.value;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const MENTION_ENTITY_BY_KEY = Object.fromEntries(
  MENTION_ENTITY_REGISTRY.map((entity) => [entity.key, entity]),
) as Record<TMentionEntityKey, TMentionEntityConfig>;

export const MENTION_ENTITY_ALIAS_MAP = MENTION_ENTITY_REGISTRY.reduce(
  (map, entity) => {
    [entity.key, entity.table, ...entity.aliases].forEach((alias) => {
      map[normalizeMentionKeyword(alias)] = entity;
    });
    return map;
  },
  {} as Record<string, TMentionEntityConfig>,
);

export const getMentionEntityByKey = (key: string) =>
  MENTION_ENTITY_BY_KEY[key as TMentionEntityKey] ?? MENTION_ENTITY_ALIAS_MAP[normalizeMentionKeyword(key)] ?? null;

export const getMentionEntityByTable = (table: string) =>
  MENTION_ENTITY_REGISTRY.find((entity) => entity.table === table) ?? null;

export const getMentionEntityByAlias = (alias: string) =>
  MENTION_ENTITY_ALIAS_MAP[normalizeMentionKeyword(alias)] ?? null;

export const getMentionEntitiesByVisibility = (visibility?: TMentionEntityVisibility) =>
  visibility ? MENTION_ENTITY_REGISTRY.filter((entity) => entity.visibility === visibility) : MENTION_ENTITY_REGISTRY;
