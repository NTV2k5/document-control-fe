import { http, HttpResponse } from 'msw';
import { 
  mockTickets as initialTickets, 
  buildCCTTSteps, 
  buildDVHCSteps,
  people 
} from '../sections/tickets/ticket.mock';
import { 
  ETicketType, 
  ETicketStatus, 
  EProcessingForm, 
  EPaymentStatus 
} from '../sections/tickets/ticket.type';

// const getApiUrl = (path: string) => {
//   const endpoint = import.meta.env.VITE_API_ENDPOINT || '';
//   if (!endpoint) return path;
//   let pathname = '';
//   if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
//     try {
//       pathname = new URL(endpoint).pathname;
//     } catch {
//       pathname = endpoint;
//     }
//   } else {
//     pathname = endpoint;
//   }
//   if (pathname.endsWith('/')) {
//     pathname = pathname.slice(0, -1);
//   }
//   return `${pathname}${path}`;
// };

const getApiUrl = (path: string) => {
  const endpoint = import.meta.env.VITE_API_ENDPOINT || '';
  // Đảm bảo endpoint không thừa dấu / ở cuối
  const cleanEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
  // Trả về full URL: https://edugate.dxfuturetech.com.vn/document-control/api/v1/...
  return `${cleanEndpoint}${path}`;
};

// RAM State Store for Simulated APIs
let activeProfile = {
  id: 'EMP-6338F20F',
  username: 'thanhquang',
  email: 'thanhquang@giadinh.edu.vn',
  first_name: 'Thanh',
  last_name: 'Quang',
  phone_number: '+84 982 727 272',
  user_type: 1, // Root/Admin
  job: 'Dean of Information Systems',
  expertise: [
    'Seasoned Dean with over 15 years of experience in higher education data governance and information systems management. Leading the digital transformation initiative at University Central.',
  ],
  profile_url:
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',

  permission_codes: [
    'TECH_ROOT',
    'ADMIN',
    'ROOT',
    'MANAGE_USERS',
    'ACCESS_TEMPLATES',
    'ACCESS_DOCUMENTS',
    'ACCESS_DASHBOARD',
  ],
  scope_assignments: [],
};

// 24 mock documents matching Figma design specs
let mockDocumentsList = [
  // 1. Academic Integrity Policy 2024
  {
    id: 'mock-doc-1',
    template_id: 'mock-template-1',
    title: 'Academic Integrity Policy 2024',
    description: 'New guidelines regarding the use of generative AI in coursework and examinations.',
    artifact_type: 'pdf',
    status: 'APPROVED',
    is_published: true,
    created_by: 'Admin Office',
    created_at: new Date('2023-10-12T10:00:00Z').toISOString(),
    updated_at: new Date('2023-10-12T10:00:00Z').toISOString(),
    visibility: 'PUBLIC',
    template: {
      id: 'mock-template-1',
      name: 'Academic Policy Template',
      version: 1,
      status: 'APPROVED',
      template_type: 'REGULATION',
      artifact_type: 'pdf',
      visibility: 'PUBLIC',
      organization_unit_id: 'mock-unit',
      source_file_name: 'academic_integrity_policy.pdf',
      template_metadata: null,
    },
    permissions: {
      can_edit: true,
      can_delete: true,
      can_submit: true,
      can_approve: true,
      can_reject: true,
      can_publish: true,
      can_unpublish: true,
      can_reset_to_draft: true,
    },
    approval: null
  },
  // 2. Staff Wellbeing Framework
  {
    id: 'mock-doc-2',
    template_id: 'mock-template-2',
    title: 'Staff Wellbeing Framework',
    description: 'Comprehensive support systems for academic and support staff across all campuses.',
    artifact_type: 'pdf',
    status: 'APPROVED',
    is_published: true,
    created_by: 'HR Dept',
    created_at: new Date('2023-10-10T10:00:00Z').toISOString(),
    updated_at: new Date('2023-10-10T10:00:00Z').toISOString(),
    visibility: 'PUBLIC',
    template: {
      id: 'mock-template-2',
      name: 'HR Policy Template',
      version: 1,
      status: 'APPROVED',
      template_type: 'POLICY',
      artifact_type: 'pdf',
      visibility: 'PUBLIC',
      organization_unit_id: 'mock-unit',
      source_file_name: 'staff_wellbeing_framework.pdf',
      template_metadata: null,
    },
    permissions: {
      can_edit: true,
      can_delete: true,
      can_submit: true,
      can_approve: true,
      can_reject: true,
      can_publish: true,
      can_unpublish: true,
      can_reset_to_draft: true,
    },
    approval: null
  },
  // 3. IT Resource Usage Guide
  {
    id: 'mock-doc-3',
    template_id: 'mock-template-3',
    title: 'IT Resource Usage Guide',
    description: 'Standard operating procedures for accessing high-performance computing clusters.',
    artifact_type: 'pdf',
    status: 'APPROVED',
    is_published: true,
    created_by: 'IT Services',
    created_at: new Date('2023-10-08T10:00:00Z').toISOString(),
    updated_at: new Date('2023-10-08T10:00:00Z').toISOString(),
    visibility: 'PUBLIC',
    template: {
      id: 'mock-template-3',
      name: 'IT Guideline Template',
      version: 1,
      status: 'APPROVED',
      template_type: 'GUIDELINE',
      artifact_type: 'pdf',
      visibility: 'PUBLIC',
      organization_unit_id: 'mock-unit',
      source_file_name: 'it_resource_usage_guide.pdf',
      template_metadata: null,
    },
    permissions: {
      can_edit: true,
      can_delete: true,
      can_submit: true,
      can_approve: true,
      can_reject: true,
      can_publish: true,
      can_unpublish: true,
      can_reset_to_draft: true,
    },
    approval: null
  },

  // 4. Quantum Neural Networks: Analysis 2024
  {
    id: 'mock-doc-4',
    template_id: 'mock-template-4',
    title: 'Quantum Neural Networks: Analysis 2024',
    description: 'A comprehensive study on the integration of quantum computing...',
    artifact_type: 'document', // WORD
    status: 'APPROVED',
    is_published: true,
    created_by: 'Research Dept',
    created_at: new Date('2025-12-12T08:00:00Z').toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    visibility: 'PUBLIC',
    template: {
      id: 'mock-template-4',
      name: 'Research Template',
      version: 1,
      status: 'APPROVED',
      template_type: 'REGULATION',
      artifact_type: 'document',
      visibility: 'PUBLIC',
      organization_unit_id: 'mock-unit',
      source_file_name: 'quantum_neural_networks.docx',
      template_metadata: null,
    },
    permissions: {
      can_edit: true,
      can_delete: true,
      can_submit: true,
      can_approve: true,
      can_reject: true,
      can_publish: true,
      can_unpublish: true,
      can_reset_to_draft: true,
    },
    approval: null
  },

  // 5. Campus Energy Consumption Data
  {
    id: 'mock-doc-5',
    template_id: 'mock-template-5',
    title: 'Campus Energy Consumption Data',
    description: 'Real-time monitoring logs from all university facilities for sustainability...',
    artifact_type: 'spreadsheet', // EXCEL
    status: 'APPROVED',
    is_published: true,
    created_by: 'Facilities Dept',
    created_at: new Date('2025-12-11T08:00:00Z').toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000 - 5000).toISOString(), // 2 hours ago
    visibility: 'PUBLIC',
    template: {
      id: 'mock-template-5',
      name: 'Energy Data Template',
      version: 1,
      status: 'APPROVED',
      template_type: 'POLICY',
      artifact_type: 'spreadsheet',
      visibility: 'PUBLIC',
      organization_unit_id: 'mock-unit',
      source_file_name: 'energy_data.xlsx',
      template_metadata: null,
    },
    permissions: {
      can_edit: true,
      can_delete: true,
      can_submit: true,
      can_approve: true,
      can_reject: true,
      can_publish: true,
      can_unpublish: true,
      can_reset_to_draft: true,
    },
    approval: null
  },

  // 6. Ethical Research Guidelines v4 (PDF)
  {
    id: 'mock-doc-6',
    template_id: 'mock-template-6',
    title: 'Ethical Research Guidelines v4',
    description: 'Mandatory compliance document for all student researchers...',
    artifact_type: 'pdf', // PDF
    status: 'APPROVED',
    is_published: true,
    created_by: 'Academic Affairs',
    created_at: new Date('2025-12-09T08:00:00Z').toISOString(),
    updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    visibility: 'PUBLIC',
    template: {
      id: 'mock-template-6',
      name: 'Ethics Template',
      version: 1,
      status: 'APPROVED',
      template_type: 'POLICY',
      artifact_type: 'pdf',
      visibility: 'PUBLIC',
      organization_unit_id: 'mock-unit',
      source_file_name: 'ethics_guidelines_v4.pdf',
      template_metadata: null,
    },
    permissions: {
      can_edit: true,
      can_delete: true,
      can_submit: true,
      can_approve: true,
      can_reject: true,
      can_publish: true,
      can_unpublish: true,
      can_reset_to_draft: true,
    },
    approval: null
  },

  // 7. Ethical Research Guidelines v4 (IMAGE)
  {
    id: 'mock-doc-7',
    template_id: 'mock-template-7',
    title: 'Ethical Research Guidelines v4',
    description: 'Mandatory compliance document for all student researchers...',
    artifact_type: 'image', // IMAGE
    status: 'APPROVED',
    is_published: true,
    created_by: 'Academic Affairs',
    created_at: new Date('2025-12-10T08:00:00Z').toISOString(),
    updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000 - 5000).toISOString(), // 3 hours ago
    visibility: 'PUBLIC',
    template: {
      id: 'mock-template-7',
      name: 'Ethics Template',
      version: 1,
      status: 'APPROVED',
      template_type: 'GUIDELINE',
      artifact_type: 'image',
      visibility: 'PUBLIC',
      organization_unit_id: 'mock-unit',
      source_file_name: 'ethics_guidelines_v4.png',
      template_metadata: null,
    },
    permissions: {
      can_edit: true,
      can_delete: true,
      can_submit: true,
      can_approve: true,
      can_reject: true,
      can_publish: true,
      can_unpublish: true,
      can_reset_to_draft: true,
    },
    approval: null
  },

  // 8. Ethical Research Guidelines v4 (VIDEO)
  {
    id: 'mock-doc-8',
    template_id: 'mock-template-8',
    title: 'Ethical Research Guidelines v4',
    description: 'Mandatory compliance document for all student researchers...',
    artifact_type: 'video', // VIDEO
    status: 'APPROVED',
    is_published: true,
    created_by: 'Academic Affairs',
    created_at: new Date('2025-12-08T08:00:00Z').toISOString(),
    updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    visibility: 'PUBLIC',
    template: {
      id: 'mock-template-8',
      name: 'Ethics Template',
      version: 1,
      status: 'APPROVED',
      template_type: 'POLICY',
      artifact_type: 'video',
      visibility: 'PUBLIC',
      organization_unit_id: 'mock-unit',
      source_file_name: 'ethics_guidelines_v4.mp4',
      template_metadata: null,
    },
    permissions: {
      can_edit: true,
      can_delete: true,
      can_submit: true,
      can_approve: true,
      can_reject: true,
      can_publish: true,
      can_unpublish: true,
      can_reset_to_draft: true,
    },
    approval: null
  },

  // 9. Ethical Research Guidelines v4 (TXT)
  {
    id: 'mock-doc-9',
    template_id: 'mock-template-9',
    title: 'Ethical Research Guidelines v4',
    description: 'Mandatory compliance document for all student researchers...',
    artifact_type: 'txt', // TXT
    status: 'APPROVED',
    is_published: true,
    created_by: 'Academic Affairs',
    created_at: new Date('2025-12-07T08:00:00Z').toISOString(),
    updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000 - 5000).toISOString(), // 4 hours ago
    visibility: 'PUBLIC',
    template: {
      id: 'mock-template-9',
      name: 'Ethics Template',
      version: 1,
      status: 'APPROVED',
      template_type: 'POLICY',
      artifact_type: 'txt',
      visibility: 'PUBLIC',
      organization_unit_id: 'mock-unit',
      source_file_name: 'ethics_guidelines_v4.txt',
      template_metadata: null,
    },
    permissions: {
      can_edit: true,
      can_delete: true,
      can_submit: true,
      can_approve: true,
      can_reject: true,
      can_publish: true,
      can_unpublish: true,
      can_reset_to_draft: true,
    },
    approval: null
  },
];

// Append remaining 15 documents
const extraDocs = Array.from({ length: 15 }, (_, index) => {
  const i = index + 9;
  const isAcademic = i % 2 === 0;
  return {
    id: `mock-doc-${i + 1}`,
    template_id: `mock-template-${i + 1}`,
    title: `MH-Admin_Enrollment_Form_Final_${2025 - i}`,
    artifact_type: isAcademic ? 'pdf' : 'spreadsheet',
    status: 'APPROVED',
    is_published: true,
    created_by: isAcademic ? 'Sarah Chen' : 'David Wilson',
    created_at: new Date(2025, 11 - i, 12, 10, 14, 0).toISOString(),
    updated_at: new Date(2025, 11 - i, 12, 10, 14, 0).toISOString(),
    visibility: 'PUBLIC',
    template: {
      id: `mock-template-${i + 1}`,
      name: `Template ${i + 1}`,
      version: 1,
      status: 'APPROVED',
      template_type: isAcademic ? 'ACADEMIC' : 'FINANCIAL',
      artifact_type: isAcademic ? 'pdf' : 'spreadsheet',
      visibility: 'PUBLIC',
      organization_unit_id: 'mock-unit',
      source_file_name: `template_${i + 1}.${isAcademic ? 'pdf' : 'xlsx'}`,
      template_metadata: null,
    },
    permissions: {
      can_edit: true,
      can_delete: true,
      can_submit: true,
      can_approve: true,
      can_reject: true,
      can_publish: true,
      can_unpublish: true,
      can_reset_to_draft: true,
    },
    approval: null
  };
});

let mockDocuments = [...mockDocumentsList, ...extraDocs];

let mockTickets = [...initialTickets];

let mockDepartments = [
  {
    id: 'dept-1',
    name: 'Computer Science',
    size: '45.2 GB',
    filesCount: 1500,
    iconKey: 'code',
  },
  {
    id: 'dept-2',
    name: 'Information Technology',
    size: '32.4 GB',
    filesCount: 1100,
    iconKey: 'folder',
  },
  {
    id: 'dept-3',
    name: 'Faculty of Arts',
    size: '12.8 GB',
    filesCount: 840,
    iconKey: 'paint',
  },
  {
    id: 'dept-4',
    name: 'Molecular Biology',
    size: '89.4 GB',
    filesCount: 2100,
    iconKey: 'biology',
  },
  {
    id: 'dept-5',
    name: 'Mathematics',
    size: '4.2 GB',
    filesCount: 420,
    iconKey: 'math',
  },
];

let mockProjects = [
  {
    id: 'proj-1',
    name: 'AI Research Lab',
    size: '2.02 GB',
    partnersCount: 12,
    iconKey: 'brain',
  },
  {
    id: 'proj-2',
    name: 'Campus Sustainability',
    size: '856 MB',
    filesCount: 5,
    iconKey: 'leaf',
  },
  {
    id: 'proj-3',
    name: 'Smart Campus Project',
    size: '856 MB',
    filesCount: 5,
    iconKey: 'leaf',
  },
  {
    id: 'proj-4',
    name: 'Deep Space Initiative',
    size: '15.4 GB',
    membersCount: 24,
    iconKey: 'rocket',
  },
  {
    id: 'proj-5',
    name: 'Archival Digitization',
    size: '3.1 GB',
    filesCount: 8,
    iconKey: 'scan',
  },
];

let mockFolders = [
  {
    id: 'folder-1',
    name: 'Computer Science',
    size: '23.80 MB',
    filesCount: 6,
  },
  {
    id: 'folder-2',
    name: 'Academic Archive',
    size: '63.46 MB',
    filesCount: 13,
  },
  {
    id: 'folder-3',
    name: 'Course Materials',
    size: '1.39 GB',
    filesCount: 14,
  },
  {
    id: 'folder-4',
    name: 'Research Papers',
    size: '128 MB',
    filesCount: 32,
  },
  {
    id: 'folder-5',
    name: 'Personal Project',
    size: '45.2 MB',
    filesCount: 4,
  },
  {
    id: 'folder-6',
    name: 'Submission Inbox',
    size: '12.1 GB',
    filesCount: 150,
  },
];

let mockFiles = [
  {
    id: 'file-1',
    name: 'MHAdmin_Enrollment_Form_Final_2025',
    size: '2.4 MB',
    fileType: 'pdf',
  },
  {
    id: 'file-2',
    name: 'MHAdmin_Enrollment_Form_Final_2025',
    size: '1.2 MB',
    fileType: 'pdf',
  },
  {
    id: 'file-3',
    name: 'MHAdmin_Enrollment_Form_Final_2025',
    size: '3.1 MB',
    fileType: 'pdf',
  },
  {
    id: 'file-4',
    name: 'MHAdmin_Enrollment_Form_Final_2025',
    size: '950 KB',
    fileType: 'pdf',
  },
  {
    id: 'file-5',
    name: 'MHAdmin_Enrollment_Form_Final_2025',
    size: '4.5 MB',
    fileType: 'pdf',
  },
  {
    id: 'file-6',
    name: 'MHAdmin_Enrollment_Form_Final_2025',
    size: '2.8 MB',
    fileType: 'pdf',
  },
  {
    id: 'file-7',
    name: 'MHAdmin_Enrollment_Form_Final_2025',
    size: '1.9 MB',
    fileType: 'pdf',
  },
  {
    id: 'file-8',
    name: 'MHAdmin_Enrollment_Form_Final_2025',
    size: '3.6 MB',
    fileType: 'pdf',
  },
];

export const handlers = [
  // --- AUTH & PROFILE ---
  http.post(getApiUrl('/api/v1/auth/login'), async () => {
    return HttpResponse.json({
      data: {
        accessToken: `mock-access-token-${Date.now()}`,
        refreshToken: `mock-refresh-token-${Date.now()}`,
        expiresIn: 3600,
      },
    });
  }),

  http.get(getApiUrl('/api/v1/users/me'), () => {
    return HttpResponse.json({ data: activeProfile });
  }),

  http.patch(getApiUrl('/api/v1/users/me'), async ({ request }) => {
    const payload = (await request.json()) as any;
    activeProfile = {
      ...activeProfile,
      ...payload,
    };
    return HttpResponse.json({ data: activeProfile });
  }),

  // --- REPORTS ---
  http.get(getApiUrl('/api/v1/documents/reports/summary'), () => {
    const trend = [
      { label: '22TH JAN', count: 40 },
      { label: '23TH JAN', count: 30 },
      { label: '24TH JAN', count: 20 },
      { label: '25TH JAN', count: 27 },
      { label: '26TH JAN', count: 18 },
      { label: '27TH JAN', count: 23 },
      { label: 'TODAY', count: 35 },
    ];

    return HttpResponse.json({
      data: {
        total: mockDocuments.length,
        draft: mockDocuments.filter((d) => d.status === 'DRAFT').length,
        pending: mockDocuments.filter((d) => d.status === 'SUBMITTED').length,
        approved: mockDocuments.filter((d) => d.status === 'APPROVED').length,
        rejected: mockDocuments.filter((d) => d.status === 'REJECTED').length,
        cancelled: mockDocuments.filter((d) => d.status === 'CANCELLED').length,
        published: mockDocuments.filter((d) => d.is_published).length,
        by_status: {
          APPROVED: mockDocuments.filter((d) => d.status === 'APPROVED').length,
          SUBMITTED: mockDocuments.filter((d) => d.status === 'SUBMITTED').length,
        },
        by_template_type: {
          DOCUMENTS: 428,
          VIDEOS: 312,
          IMAGES: 544,
          OTHERS: 120,
        },
        trend,
      },
    });
  }),

  // --- DOCUMENTS ---
  http.get(getApiUrl('/api/method/drive_edms.api.published.get_published_documents'), () => {
    return HttpResponse.json({
      message: {
        data: [
          {
            name: "70a7750e98",
            file_name: "1. Luồng Cấu hình (Setup Workflow).txt",
            mime_type: "text/plain",
            owner: "Administrator",
            creation: "2026-07-16 13:52:15.721598",
            modified: "2026-07-16 13:52:15.763100",
            file_size: 3979,
            file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/1.%20Lu%E1%BB%93ng%20C%E1%BA%A5u%20h%C3%ACnh%20%28Setup%20Workflow%29.txt",
            status: "Active",
            folder: "09f303b6bf",
            views: 1,
            recipients: [],
            tags: []
          },
          {
            name: "f11d6ded4a",
            file_name: "Screenshot 2026-07-15 152114.png",
            mime_type: "image/png",
            owner: "Administrator",
            creation: "2026-07-16 13:51:13.230238",
            modified: "2026-07-16 13:51:13.352771",
            file_size: 163516,
            file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/Screenshot%202026-07-15%20152114.png",
            status: "Active",
            folder: "09f303b6bf",
            views: 1,
            recipients: [],
            tags: []
          },
          {
            name: "d2827383e9",
            file_name: "CV_PhanPhamQuocKhanh.pdf",
            mime_type: "application/pdf",
            owner: "Administrator",
            creation: "2026-07-16 13:50:48.537536",
            modified: "2026-07-16 13:50:50.874084",
            file_size: 112438,
            file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/CV_PhanPhamQuocKhanh.pdf",
            status: "Active",
            folder: "09f303b6bf",
            views: 1,
            recipients: [],
            tags: []
          },
          {
            name: "c013718b3f",
            file_name: "travel.mp4",
            mime_type: "video/mp4",
            owner: "Administrator",
            creation: "2026-07-16 13:28:42.697833",
            modified: "2026-07-16 13:41:59.725212",
            file_size: 17074788,
            file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/Ti%E1%BA%BFng%20Anh/travel.mp4",
            status: "Active",
            folder: "d3c3e8e3c9",
            views: 0,
            recipients: [],
            tags: []
          },
          {
            name: "85d4052ca2",
            file_name: "LESSON 5 - Listening (1).pptx",
            mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            owner: "Administrator",
            creation: "2026-07-16 13:28:10.757303",
            modified: "2026-07-16 13:28:10.892488",
            file_size: 3034273,
            file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/Ti%E1%BA%BFng%20Anh/LESSON%205%20-%20Listening%20%281%29.pptx",
            status: "Active",
            folder: "d3c3e8e3c9",
            views: 0,
            recipients: [],
            tags: []
          },
          {
            name: "11803bffec",
            file_name: "6366630160986.mp4",
            mime_type: "video/mp4",
            owner: "Administrator",
            creation: "2026-07-16 10:46:44.769656",
            modified: "2026-07-16 10:46:48.797724",
            file_size: 10401906,
            file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/6366630160986.mp4",
            status: "Active",
            folder: "09f303b6bf",
            views: 0,
            recipients: [],
            tags: []
          }
        ],
        total: 6,
        page_size: 10,
        start: 0
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.published.get_file_versions'), () => {
    return HttpResponse.json({
      message: [
        {
          name: "p1he7li9g0",
          creation: "2026-07-16 13:42:00.112890",
          owner: "Administrator",
          data: "{\"added\":[],\"changed\":[[\"is_private\",1,0]],\"data_import\":null,\"removed\":[],\"row_changed\":[],\"updater_reference\":null}",
          version_number: "V3",
          full_name: "Administrator",
          user_image: null
        },
        {
          name: "h8ql95b9u4",
          creation: "2026-07-16 13:28:44.255053",
          owner: "Administrator",
          data: "{\"added\":[],\"changed\":[[\"file_url\",\"/private/files/Administrator (Administrator)/Ti\\u1ebfng Anh/travel.mp4\",\"/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/Ti%E1%BA%BFng%20Anh/travel.mp4\"]],\"data_import\":null,\"removed\":[],\"row_changed\":[],\"updater_reference\":null}",
          version_number: "V2",
          full_name: "Administrator",
          user_image: null
        },
        {
          name: "h8brmrcamp",
          creation: "2026-07-16 13:28:42.709828",
          owner: "Administrator",
          data: "{\"added\":[],\"changed\":[[\"file_url\",null,\"/private/files/Administrator (Administrator)/Ti\\u1ebfng Anh/travel.mp4\"]],\"data_import\":null,\"removed\":[],\"row_changed\":[],\"updater_reference\":null}",
          version_number: "V1",
          full_name: "Administrator",
          user_image: null
        }
      ]
    });
  }),

  http.get(getApiUrl('/api/v1/documents'), ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    const created_by = url.searchParams.get('created_by') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const page_size = parseInt(url.searchParams.get('page_size') || '10', 10);
    const sort = url.searchParams.get('sort') || '';

    let filtered = [...mockDocuments];

    if (search) {
      filtered = filtered.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()));
    }
    if (status) {
      filtered = filtered.filter((d) => d.status === status);
    }
    if (created_by) {
      filtered = filtered.filter((d) => d.created_by === created_by);
    }

    if (sort === 'desc:created_at') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sort === 'desc:updated_at') {
      filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }

    const startIndex = (page - 1) * page_size;
    const paginated = filtered.slice(startIndex, startIndex + page_size);

    return HttpResponse.json({
      data: paginated,
      pagination: {
        page,
        page_size,
        total_pages: Math.ceil(filtered.length / page_size),
        total: filtered.length,
      },
    });
  }),

  http.get(getApiUrl('/api/v1/documents/:id'), ({ params }) => {
    const doc = mockDocuments.find((d) => d.id === params.id);
    if (!doc) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({ data: doc });
  }),

  http.post(getApiUrl('/api/v1/documents'), async ({ request }) => {
    const payload = (await request.json()) as any;
    const newDoc = {
      id: `mock-doc-${Date.now()}`,
      template_id: payload.template_id || `mock-template-${Date.now()}`,
      title: payload.title || 'Untitled Document',
      artifact_type: payload.artifact_type || 'image_form',
      status: 'DRAFT' as any,
      is_published: false,
      created_by: 'Thanh Quang',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      visibility: 'PUBLIC' as any,
      template: {
        id: payload.template_id || `mock-template-${Date.now()}`,
        name: 'Custom Template',
        version: 1,
        status: 'APPROVED',
        template_type: 'ACADEMIC',
        artifact_type: payload.artifact_type || 'image_form',
        visibility: 'PUBLIC',
        organization_unit_id: 'mock-unit',
        source_file_name: 'template.pdf',
        template_metadata: null,
      },
      permissions: {
        can_edit: true,
        can_delete: true,
        can_submit: true,
        can_approve: true,
        can_reject: true,
        can_publish: true,
        can_unpublish: true,
        can_reset_to_draft: true,
      },
      approval: null,
    };

    mockDocuments = [newDoc, ...mockDocuments];
    return HttpResponse.json({ data: newDoc });
  }),

  http.patch(getApiUrl('/api/v1/documents/:id'), async ({ params, request }) => {
    const payload = (await request.json()) as any;
    const index = mockDocuments.findIndex((d) => d.id === params.id);
    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    mockDocuments[index] = {
      ...mockDocuments[index],
      ...payload,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json({ data: mockDocuments[index] });
  }),

  http.delete(getApiUrl('/api/v1/documents/:id'), ({ params }) => {
    mockDocuments = mockDocuments.filter((d) => d.id !== params.id);
    return HttpResponse.json({ success: true });
  }),

  http.post(getApiUrl('/api/v1/documents/:id/submit'), ({ params }) => {
    const index = mockDocuments.findIndex((d) => d.id === params.id);
    if (index === -1) return new HttpResponse(null, { status: 404 });

    mockDocuments[index].status = 'SUBMITTED';
    return HttpResponse.json({ data: mockDocuments[index] });
  }),

  http.post(getApiUrl('/api/v1/documents/:id/approve'), ({ params }) => {
    const index = mockDocuments.findIndex((d) => d.id === params.id);
    if (index === -1) return new HttpResponse(null, { status: 404 });

    mockDocuments[index].status = 'APPROVED';
    return HttpResponse.json({ data: mockDocuments[index] });
  }),

  http.post(getApiUrl('/api/v1/documents/:id/reject'), async ({ params }) => {
    const index = mockDocuments.findIndex((d) => d.id === params.id);
    if (index === -1) return new HttpResponse(null, { status: 404 });

    mockDocuments[index].status = 'REJECTED';
    return HttpResponse.json({ data: mockDocuments[index] });
  }),

  http.post(getApiUrl('/api/v1/documents/:id/publish'), ({ params }) => {
    const index = mockDocuments.findIndex((d) => d.id === params.id);
    if (index === -1) return new HttpResponse(null, { status: 404 });

    mockDocuments[index].is_published = true;
    return HttpResponse.json({ data: mockDocuments[index] });
  }),

  http.post(getApiUrl('/api/v1/documents/:id/unpublish'), ({ params }) => {
    const index = mockDocuments.findIndex((d) => d.id === params.id);
    if (index === -1) return new HttpResponse(null, { status: 404 });

    mockDocuments[index].is_published = false;
    return HttpResponse.json({ data: mockDocuments[index] });
  }),

  // --- APPROVAL DASHBOARD ---
  http.get(getApiUrl('/api/v1/approval-dashboard/documents'), () => {
    const todoDocs = mockDocuments
      .filter((d) => d.status === 'SUBMITTED')
      .map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        template_type: d.template.template_type,
        template_name: d.template.name,
        created_by: d.created_by,
        created_at: d.created_at,
        updated_at: d.updated_at,
        approval: {
          instance_id: `inst-${d.id}`,
          status: d.status as any,
          total_steps: 3,
          steps: [],
        },
        bucket_flags: {
          todo: true,
          mine: false,
          upcoming: false,
          done: false,
          watching: false,
        },
      }));

    return HttpResponse.json({ data: todoDocs });
  }),

  http.get(getApiUrl('/api/v1/approval-dashboard/summary'), () => {
    const todoCount = mockDocuments.filter((d) => d.status === 'SUBMITTED').length;
    return HttpResponse.json({
      data: {
        mine: 0,
        todo: todoCount,
        upcoming: 0,
        done: 12,
        watching: 0,
      },
    });
  }),

  // --- UNIVERSITY HUBS ---
  http.get(getApiUrl('/api/method/drive_edms.api.university_hub.get_hub_stats'), () => {
    return HttpResponse.json({
      message: {
        Images: { count: 0, size: 0 },
        Videos: { count: 1, size: 17074788.0 },
        Documents: { count: 1, size: 516773.0 },
        Other: { count: 0, size: 0 }
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.university_hub.get_hub_folders'), async ({ request }) => {
    let category = 'Department';
    try {
      const body = await request.clone().json() as any;
      if (body && body.category) {
        category = body.category;
      }
    } catch {
      // ignore
    }

    if (category === 'Project') {
      return HttpResponse.json({
        message: {
          data: [
            {
              name: "fb64643df8",
              file_name: "Document1.docx",
              modified: "2026-07-16 17:56:21.455920",
              folder: "748bd378e2",
              owner: "Administrator",
              mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              owner_fullname: "Administrator",
              owner_image: null
            }
          ],
          total: 1,
          page_size: 10,
          start: 0
        }
      });
    }

    return HttpResponse.json({
      message: {
        data: [
          {
            name: "fb64643df8",
            file_name: "Document1.docx",
            modified: "2026-07-16 17:56:21.455920",
            folder: "748bd378e2",
            owner: "Administrator",
            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            owner_fullname: "Administrator",
            owner_image: null
          },
          {
            name: "c013718b3f",
            file_name: "travel.mp4",
            modified: "2026-07-16 13:41:59.725212",
            folder: "d3c3e8e3c9",
            owner: "Administrator",
            mime_type: "video/mp4",
            owner_fullname: "Administrator",
            owner_image: null
          }
        ],
        total: 2,
        page_size: 10,
        start: 0
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.university_hub.get_recent_activity'), () => {
    return HttpResponse.json({
      message: {
        data: [
          {
            name: "fb64643df8",
            file_name: "Document1.docx",
            modified: "2026-07-16 17:56:21.455920",
            folder: "748bd378e2",
            owner: "Administrator",
            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            owner_fullname: "Administrator",
            owner_image: null
          },
          {
            name: "c013718b3f",
            file_name: "travel.mp4",
            modified: "2026-07-16 13:41:59.725212",
            folder: "d3c3e8e3c9",
            owner: "Administrator",
            mime_type: "video/mp4",
            owner_fullname: "Administrator",
            owner_image: null
          }
        ],
        total: 2,
        page_size: 10,
        start: 0
      }
    });
  }),

  http.get(getApiUrl('/api/v1/hubs/departments'), () => {
    return HttpResponse.json({ data: mockDepartments });
  }),

  http.post(getApiUrl('/api/v1/hubs/departments/:id/archive'), ({ params }) => {
    mockDepartments = mockDepartments.filter((d) => d.id !== params.id);
    return HttpResponse.json({ success: true });
  }),

  http.get(getApiUrl('/api/v1/hubs/projects'), () => {
    return HttpResponse.json({ data: mockProjects });
  }),

  http.post(getApiUrl('/api/v1/hubs/projects/:id/archive'), ({ params }) => {
    mockProjects = mockProjects.filter((p) => p.id !== params.id);
    return HttpResponse.json({ success: true });
  }),

  // --- MY HUBS ---
  http.get(getApiUrl('/api/method/drive_edms.api.my_hubs.get_my_folders'), () => {
    return HttpResponse.json({
      message: {
        data: [
          {
            name: "b947899c1e",
            file_name: "áds",
            folder: "d3c3e8e3c9",
            creation: "2026-07-16 16:03:12.626853",
            total_files: 0,
            total_size: 0
          },
          {
            name: "d3c3e8e3c9",
            file_name: "Tiếng Anh",
            folder: "09f303b6bf",
            creation: "2026-07-16 13:27:40.689495",
            total_files: 2,
            total_size: 20109061.0
          },
          {
            name: "09f303b6bf",
            file_name: "Drive - evjem9pjqi",
            folder: null,
            creation: "2026-07-16 10:40:59.753247",
            total_files: 5,
            total_size: 10699093.0
          },
          {
            name: "Home/Attachments",
            file_name: "Attachments",
            folder: "Home",
            creation: "2026-07-16 08:49:47.302227",
            total_files: 0,
            total_size: 0
          },
          {
            name: "Home",
            file_name: "Home",
            folder: null,
            creation: "2026-07-16 08:49:47.300288",
            total_files: 0,
            total_size: 0
          }
        ],
        total: 5,
        page_size: 20,
        start: 0
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.my_hubs.get_my_files'), () => {
    return HttpResponse.json({
      message: {
        data: [
          {
            name: "70a7750e98",
            file_name: "1. Luồng Cấu hình (Setup Workflow).txt",
            modified: "2026-07-16 13:52:15.763100",
            creation: "2026-07-16 13:52:15.721598",
            folder: "09f303b6bf",
            owner: "Administrator",
            mime_type: "text/plain",
            file_size: 3979
          },
          {
            name: "f11d6ded4a",
            file_name: "Screenshot 2026-07-15 152114.png",
            modified: "2026-07-16 13:51:13.352771",
            creation: "2026-07-16 13:51:13.230238",
            folder: "09f303b6bf",
            owner: "Administrator",
            mime_type: "image/png",
            file_size: 163516
          },
          {
            name: "d2827383e9",
            file_name: "CV_PhanPhamQuocKhanh.pdf",
            modified: "2026-07-16 13:50:50.874084",
            creation: "2026-07-16 13:50:48.537536",
            folder: "09f303b6bf",
            owner: "Administrator",
            mime_type: "application/pdf",
            file_size: 112438
          },
          {
            name: "c013718b3f",
            file_name: "travel.mp4",
            modified: "2026-07-16 13:41:59.725212",
            creation: "2026-07-16 13:28:42.697833",
            folder: "d3c3e8e3c9",
            owner: "Administrator",
            mime_type: "video/mp4",
            file_size: 17074788
          },
          {
            name: "85d4052ca2",
            file_name: "LESSON 5 - Listening (1).pptx",
            modified: "2026-07-16 13:28:10.892488",
            creation: "2026-07-16 13:28:10.757303",
            folder: "d3c3e8e3c9",
            owner: "Administrator",
            mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            file_size: 3034273
          },
          {
            name: "11803bffec",
            file_name: "6366630160986.mp4",
            modified: "2026-07-16 10:46:48.797724",
            creation: "2026-07-16 10:46:44.769656",
            folder: "09f303b6bf",
            owner: "Administrator",
            mime_type: "video/mp4",
            file_size: 10401906
          }
        ],
        total: 6,
        page_size: 10,
        start: 0
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.my_hubs.get_my_recent_activity'), () => {
    return HttpResponse.json({
      message: {
        data: [
          {
            name: "70a7750e98",
            file_name: "1. Luồng Cấu hình (Setup Workflow).txt",
            modified: "2026-07-16 13:52:15.763100",
            folder: "09f303b6bf",
            owner: "Administrator",
            mime_type: "text/plain",
            owner_fullname: "Administrator",
            owner_image: null
          },
          {
            name: "f11d6ded4a",
            file_name: "Screenshot 2026-07-15 152114.png",
            modified: "2026-07-16 13:51:13.352771",
            folder: "09f303b6bf",
            owner: "Administrator",
            mime_type: "image/png",
            owner_fullname: "Administrator",
            owner_image: null
          },
          {
            name: "d2827383e9",
            file_name: "CV_PhanPhamQuocKhanh.pdf",
            modified: "2026-07-16 13:50:50.874084",
            folder: "09f303b6bf",
            owner: "Administrator",
            mime_type: "application/pdf",
            owner_fullname: "Administrator",
            owner_image: null
          },
          {
            name: "c013718b3f",
            file_name: "travel.mp4",
            modified: "2026-07-16 13:41:59.725212",
            folder: "d3c3e8e3c9",
            owner: "Administrator",
            mime_type: "video/mp4",
            owner_fullname: "Administrator",
            owner_image: null
          },
          {
            name: "85d4052ca2",
            file_name: "LESSON 5 - Listening (1).pptx",
            modified: "2026-07-16 13:28:10.892488",
            folder: "d3c3e8e3c9",
            owner: "Administrator",
            mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            owner_fullname: "Administrator",
            owner_image: null
          },
          {
            name: "11803bffec",
            file_name: "6366630160986.mp4",
            modified: "2026-07-16 10:46:48.797724",
            folder: "09f303b6bf",
            owner: "Administrator",
            mime_type: "video/mp4",
            owner_fullname: "Administrator",
            owner_image: null
          }
        ],
        total: 6,
        page_size: 10,
        start: 0
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.my_hubs.get_my_stats'), () => {
    return HttpResponse.json({
      message: {
        Images: {
          count: 1,
          size: 163516.0
        },
        Videos: {
          count: 2,
          size: 27476694.0
        },
        Documents: {
          count: 3,
          size: 3150690.0
        },
        Other: {
          count: 0,
          size: 0
        }
      }
    });
  }),

  http.get(getApiUrl('/api/v1/my-hubs/folders'), () => {
    return HttpResponse.json({ data: mockFolders });
  }),

  http.post(getApiUrl('/api/v1/my-hubs/folders'), async ({ request }) => {
    const payload = (await request.json()) as any;
    const newFolder = {
      id: `folder-${Date.now()}`,
      name: payload.name || 'New Folder',
      size: '0 B',
      filesCount: 0,
    };
    mockFolders = [...mockFolders, newFolder];
    return HttpResponse.json({ data: newFolder });
  }),

  http.delete(getApiUrl('/api/v1/my-hubs/folders/:id'), ({ params }) => {
    mockFolders = mockFolders.filter((f) => f.id !== params.id);
    return HttpResponse.json({ success: true });
  }),

  http.get(getApiUrl('/api/v1/my-hubs/files'), () => {
    return HttpResponse.json({ data: mockFiles });
  }),

  http.post(getApiUrl('/api/v1/my-hubs/files'), async ({ request }) => {
    const payload = (await request.json()) as any;
    const newFile = {
      id: `file-${Date.now()}`,
      name: payload.name || 'New File',
      size: payload.size || '0 B',
      fileType: payload.fileType || 'pdf',
    };
    mockFiles = [newFile, ...mockFiles];
    return HttpResponse.json({ data: newFile });
  }),

  http.delete(getApiUrl('/api/v1/my-hubs/files/:id'), ({ params }) => {
    mockFiles = mockFiles.filter((f) => f.id !== params.id);
    return HttpResponse.json({ success: true });
  }),

  // --- TICKETS ---
  http.get(getApiUrl('/api/v1/tickets'), () => {
    return HttpResponse.json({ data: mockTickets });
  }),

  http.post(getApiUrl('/api/v1/tickets'), async ({ request }) => {
    const payload = (await request.json()) as any;
    const assignee = people.tranThiMai;
    const ticketType = (payload.type || ETicketType.DICH_VU_HANH_CHINH) as ETicketType;
    const processingForm = (payload.processingForm || EProcessingForm.ONLINE_KY_SO) as EProcessingForm;
    const hasFee = !!payload.hasFee;
    const feeAmount = payload.feeAmount || 0;
    
    let steps: any[] = [];
    if (ticketType === ETicketType.CUNG_CAP_THONG_TIN) {
      steps = buildCCTTSteps(assignee, 'new');
    } else {
      // For DICH_VU_HANH_CHINH: if hasFee, currentStep starts at 2; otherwise starts at 1
      const startStep = hasFee ? 2 : 1;
      steps = buildDVHCSteps(assignee, hasFee, processingForm, startStep, payload.documentCode);
    }

    const newTicket = {
      id: `ticket-${Date.now()}`,
      code: `SV-${Math.floor(1000 + Math.random() * 9000)}`,
      title: payload.title || 'Untitled Request',
      content: payload.content || '',
      student: payload.student || {
        id: 'p1',
        name: 'Nguyễn Văn An',
        mssv: '2174801000',
        role: 'Sinh viên',
        department: 'Khoa CNTT',
      },
      type: ticketType,
      creator: payload.student || {
        id: 'p1',
        name: 'Nguyễn Văn An',
        mssv: '2174801000',
        role: 'Sinh viên',
        department: 'Khoa CNTT',
      },
      createdAt: new Date().toISOString(),
      source: payload.source || 'TAO_TICKET',
      documentCode: payload.documentCode || 'PVB-802',
      processingForm,
      hasFee,
      paymentStatus: hasFee ? EPaymentStatus.CHUA_THANH_TOAN : EPaymentStatus.KHONG_THU_PHI,
      feeAmount,
      assignee,
      supporters: [],
      notifyRecipients: [],
      deadline: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      status: ETicketStatus.MOI,
      slaPercent: 100,
      slaLabel: 'Còn 7 ngày',
      attachments: [],
      steps,
    };

    mockTickets = [newTicket, ...mockTickets];
    return HttpResponse.json({ data: newTicket });
  }),

  // --- DASHBOARD ---
  http.get(getApiUrl('/api/method/drive_edms.api.dashboard.trending_now'), () => {
    return HttpResponse.json({
      message: [
        {
          name: "d2827383e9",
          file_name: "CV_PhanPhamQuocKhanh.pdf",
          mime_type: "application/pdf",
          owner: "Administrator",
          creation: "2026-07-16 13:50:48.537536",
          views: 1
        },
        {
          name: "f11d6ded4a",
          file_name: "Screenshot 2026-07-15 152114.png",
          mime_type: "image/png",
          owner: "Administrator",
          creation: "2026-07-16 13:51:13.230238",
          views: 1
        },
        {
          name: "70a7750e98",
          file_name: "1. Luồng Cấu hình (Setup Workflow).txt",
          mime_type: "text/plain",
          owner: "Administrator",
          creation: "2026-07-16 13:52:15.721598",
          views: 1
        }
      ]
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.dashboard.summary_stats'), () => {
    return HttpResponse.json({
      message: {
        published_files: 6,
        my_files: 6,
        sharing_files: 0
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.dashboard.engagement'), () => {
    return HttpResponse.json({
      message: [
        {
          date: "2026-07-16",
          views: 3
        }
      ]
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.dashboard.file_distribution'), () => {
    return HttpResponse.json({
      message: {
        Documents: 3,
        Images: 1,
        Videos: 2,
        Others: 0
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.dashboard.documents_latest'), () => {
    return HttpResponse.json({
      message: [
        {
          name: "70a7750e98",
          file_name: "1. Luồng Cấu hình (Setup Workflow).txt",
          folder: "09f303b6bf",
          file_url: null,
          file_size: 3979,
          file_type: "Text",
          is_folder: 0,
          content_doctype: null,
          content_docname: null,
          team: "evjem9pjqi",
          creation: "2026-07-16 13:52:15.721598",
          modified: "2026-07-16 04:41:49.808000",
          owner: "Administrator",
          attached_to_doctype: null,
          attached_to_name: null,
          shared_team: null,
          owner_full_name: "Administrator",
          owner_image: null,
          is_favourite: null,
          accessed: null,
          child_count: 0,
          share_count: 0,
          kind: "native",
          read: 1,
          comment: 1,
          share: 1,
          upload: 1,
          write: 1,
          type: "admin"
        },
        {
          name: "f11d6ded4a",
          file_name: "Screenshot 2026-07-15 152114.png",
          folder: "09f303b6bf",
          file_url: null,
          file_size: 163516,
          file_type: "Image",
          is_folder: 0,
          content_doctype: null,
          content_docname: null,
          team: "evjem9pjqi",
          creation: "2026-07-16 13:51:13.230238",
          modified: "2025-03-02 13:46:43.407000",
          owner: "Administrator",
          attached_to_doctype: null,
          attached_to_name: null,
          shared_team: null,
          owner_full_name: "Administrator",
          owner_image: null,
          is_favourite: null,
          accessed: "2026-07-16 16:51:32.104088",
          child_count: 0,
          share_count: 0,
          kind: "native",
          read: 1,
          comment: 1,
          share: 1,
          upload: 1,
          write: 1,
          type: "admin"
        },
        {
          name: "d2827383e9",
          file_name: "CV_PhanPhamQuocKhanh.pdf",
          folder: "09f303b6bf",
          file_url: null,
          file_size: 112438,
          file_type: "PDF",
          is_folder: 0,
          content_doctype: null,
          content_docname: null,
          team: "evjem9pjqi",
          creation: "2026-07-16 13:50:48.537536",
          modified: "2026-07-12 09:25:37.888000",
          owner: "Administrator",
          attached_to_doctype: null,
          attached_to_name: null,
          shared_team: null,
          owner_full_name: "Administrator",
          owner_image: null,
          is_favourite: null,
          accessed: "2026-07-16 14:19:52.112621",
          child_count: 0,
          share_count: 0,
          kind: "native",
          read: 1,
          comment: 1,
          share: 1,
          upload: 1,
          write: 1,
          type: "admin"
        },
        {
          name: "c013718b3f",
          file_name: "travel.mp4",
          folder: "d3c3e8e3c9",
          file_url: null,
          file_size: 17074788,
          file_type: "Video",
          is_folder: 0,
          content_doctype: null,
          content_docname: null,
          team: "evjem9pjqi",
          creation: "2026-07-16 13:28:42.697833",
          modified: "2025-04-26 09:10:10.096000",
          owner: "Administrator",
          attached_to_doctype: null,
          attached_to_name: null,
          shared_team: null,
          owner_full_name: "Administrator",
          owner_image: null,
          is_favourite: null,
          accessed: null,
          child_count: 0,
          share_count: 0,
          kind: "native",
          read: 1,
          comment: 1,
          share: 1,
          upload: 1,
          write: 1,
          type: "admin"
        },
        {
          name: "85d4052ca2",
          file_name: "LESSON 5 - Listening (1).pptx",
          folder: "d3c3e8e3c9",
          file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/Ti%E1%BA%BFng%20Anh/LESSON%205%20-%20Listening%20%281%29.pptx",
          file_size: 3034273,
          file_type: "Presentation",
          is_folder: 0,
          content_doctype: null,
          content_docname: null,
          team: "evjem9pjqi",
          creation: "2026-07-16 13:28:10.757303",
          modified: "2025-09-27 09:32:16.948000",
          owner: "Administrator",
          attached_to_doctype: null,
          attached_to_name: null,
          shared_team: null,
          owner_full_name: "Administrator",
          owner_image: null,
          is_favourite: null,
          accessed: null,
          child_count: 0,
          share_count: 0,
          kind: "native",
          read: 1,
          comment: 1,
          share: 1,
          upload: 1,
          write: 1,
          type: "admin"
        },
        {
          name: "11803bffec",
          file_name: "6366630160986.mp4",
          folder: "09f303b6bf",
          file_url: null,
          file_size: 10401906,
          file_type: "Video",
          is_folder: 0,
          content_doctype: null,
          content_docname: null,
          team: "evjem9pjqi",
          creation: "2026-07-16 10:46:44.769656",
          modified: "2025-03-02 13:46:43.407000",
          owner: "Administrator",
          attached_to_doctype: null,
          attached_to_name: null,
          shared_team: null,
          owner_full_name: "Administrator",
          owner_image: null,
          is_favourite: null,
          accessed: null,
          child_count: 0,
          share_count: 0,
          kind: "native",
          read: 1,
          comment: 1,
          share: 1,
          upload: 1,
          write: 1,
          type: "admin"
        }
      ]
    });
  }),
];

