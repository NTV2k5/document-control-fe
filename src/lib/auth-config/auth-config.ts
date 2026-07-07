export const publicPaths: string[] = ['/sign-in'];

const docxExportPreviewPath = '/docx-export-preview';
const templateVariableDocsPath = '/template-variable-docs';
const settingsPath = '/settings';
const legacyOpenAiSettingsPath = '/openai';

const commonPaths = [docxExportPreviewPath, '/home', '/change-password'];
const dashboardPaths = ['/dashboard'];
const templatePaths = ['/templates'];
const documentPaths = ['/documents'];
const templateAgentPaths = ['/template-agent'];
const techRootPaths = [
  '/template-variables',
  templateVariableDocsPath,
  settingsPath,
  legacyOpenAiSettingsPath,
  ...templateAgentPaths,
];
const documentInputAgentPaths = ['/document-input-agent'];
const documentInputAgentHistoryPaths = ['/document-input-agent-history'];

const adminPaths = [
  ...commonPaths,
  ...dashboardPaths,
  ...templatePaths,
  ...documentPaths,
  ...documentInputAgentPaths,
  ...documentInputAgentHistoryPaths,
  settingsPath,
  legacyOpenAiSettingsPath,
  '/admin',
];
const templateUserPaths = [...commonPaths, ...dashboardPaths, ...templatePaths, ...documentInputAgentPaths];
const documentUserPaths = [...commonPaths, ...dashboardPaths, ...documentPaths, ...documentInputAgentPaths];
const techRootUserPaths = [...commonPaths, ...techRootPaths];

// After login, redirect to this path based on group
export const groupAreaMap: Record<string, string> = {
  '/admin': '/home',
  '/tech-root': '/home',
  '/dashboard': '/home',
  '/templates': '/home',
  '/documents': '/home',
  '/manager': '/home',
  '/viewer': '/home',
};

export const groupAccessMap: Record<string, string[]> = {
  '/admin': adminPaths,
  '/manager': adminPaths,
  '/tech-root': techRootUserPaths,
  '/dashboard': dashboardPaths,
  '/templates': templateUserPaths,
  '/documents': documentUserPaths,
  '/viewer': commonPaths,
};

// Priority order: admin checked first
export const groupPriority = ['/admin', '/manager', '/tech-root', '/dashboard', '/templates', '/documents', '/viewer'];
