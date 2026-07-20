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
  if (import.meta.env.DEV) {
    return path;
  }
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

let mockDriveFolders = [
  // Departments
  {
    name: "fb64643df8",
    file_name: "Tài liệu đào tạo (Training Docs)",
    modified: "2026-07-16 17:56:21.455920",
    folder: "748bd378e2",
    owner: "Administrator",
    mime_type: "Folder",
    owner_fullname: "Administrator",
    owner_image: null,
    category: "Department",
    total_files: 1,
    total_size: 3034273
  },
  {
    name: "d3c3e8e3c9",
    file_name: "Tiếng Anh (English)",
    modified: "2026-07-16 13:41:59.725212",
    folder: "09f303b6bf",
    owner: "Administrator",
    mime_type: "Folder",
    owner_fullname: "Administrator",
    owner_image: null,
    category: "Department",
    total_files: 2,
    total_size: 20109061
  },
  
  // Projects
  {
    name: "748bd378e2",
    file_name: "Dự án Công nghệ (Tech Project)",
    modified: "2026-07-16 17:56:21.455920",
    folder: "root",
    owner: "Administrator",
    mime_type: "Folder",
    owner_fullname: "Administrator",
    owner_image: null,
    category: "Project",
    total_files: 1,
    total_size: 3034273
  },

  // My Hub Folders
  {
    name: "b947899c1e",
    file_name: "áds",
    folder: "d3c3e8e3c9",
    creation: "2026-07-16 16:03:12.626853",
    modified: "2026-07-16 16:03:12.626853",
    owner: "Administrator",
    mime_type: "Folder",
    owner_fullname: "Administrator",
    owner_image: null,
    category: "MyHub"
  },
  {
    name: "Home/Attachments",
    file_name: "Attachments",
    folder: "Home",
    creation: "2026-07-16 08:49:47.302227",
    modified: "2026-07-16 08:49:47.302227",
    owner: "Administrator",
    mime_type: "Folder",
    owner_fullname: "Administrator",
    owner_image: null,
    category: "MyHub"
  },
  {
    name: "Home",
    file_name: "Home",
    folder: null,
    creation: "2026-07-16 08:49:47.300288",
    modified: "2026-07-16 08:49:47.300288",
    owner: "Administrator",
    mime_type: "Folder",
    owner_fullname: "Administrator",
    owner_image: null,
    category: "MyHub"
  },
  {
    name: "09f303b6bf",
    file_name: "Drive - evjem9pjqi",
    folder: null,
    creation: "2026-07-16 10:40:59.753247",
    modified: "2026-07-16 10:40:59.753247",
    owner: "Administrator",
    mime_type: "Folder",
    owner_fullname: "Administrator",
    owner_image: null,
    category: "MyHub"
  }
];

let mockDriveFiles = [
  {
    name: "70a7750e98",
    file_name: "1. Luồng Cấu hình (Setup Workflow).txt",
    folder: "09f303b6bf",
    file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/1.%20Lu%E1%BB%93ng%20C%E1%BA%A5u%20h%C3%ACnh%20%28Setup%20Workflow%29.txt",
    file_size: 3979,
    file_type: "Text",
    mime_type: "text/plain",
    is_folder: 0,
    creation: "2026-07-16 13:52:15.721598",
    modified: "2026-07-16 13:52:15.763100",
    owner: "Administrator",
    owner_fullname: "Sarah Chen",
    owner_image: null,
    views: 1,
    status: "Active",
    recipients: ["dean.is@giadinh.edu.vn"],
    tags: ["Workflow", "Setup"]
  },
  {
    name: "f11d6ded4a",
    file_name: "Screenshot 2026-07-15 152114.png",
    folder: "09f303b6bf",
    file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/Screenshot%202026-07-15%20152114.png",
    file_size: 163516,
    file_type: "Image",
    mime_type: "image/png",
    is_folder: 0,
    creation: "2026-07-16 13:51:13.230238",
    modified: "2026-07-16 13:51:13.352771",
    owner: "Administrator",
    owner_fullname: "David Wilson",
    owner_image: null,
    views: 1,
    status: "Active",
    recipients: [],
    tags: ["UI", "Config"]
  },
  {
    name: "d2827383e9",
    file_name: "CV_PhanPhamQuocKhanh.pdf",
    folder: "09f303b6bf",
    file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/CV_PhanPhamQuocKhanh.pdf",
    file_size: 112438,
    file_type: "Document",
    mime_type: "application/pdf",
    is_folder: 0,
    creation: "2026-07-16 13:50:48.537536",
    modified: "2026-07-16 13:50:50.874084",
    owner: "Administrator",
    owner_fullname: "Sarah Jenkins",
    owner_image: null,
    views: 1,
    status: "Active",
    recipients: ["recruitment@giadinh.edu.vn"],
    tags: ["CV", "HR"]
  },
  {
    name: "c013718b3f",
    file_name: "travel.mp4",
    folder: "d3c3e8e3c9",
    file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/Ti%E1%BA%BFng%20Anh/travel.mp4",
    file_size: 17074788,
    file_type: "Video",
    mime_type: "video/mp4",
    is_folder: 0,
    creation: "2026-07-16 13:28:42.697833",
    modified: "2026-07-16 13:41:59.725212",
    owner: "Administrator",
    owner_fullname: "Administrator",
    owner_image: null,
    views: 0,
    status: "Active",
    recipients: [],
    tags: ["Video", "Asset"]
  },
  {
    name: "85d4052ca2",
    file_name: "LESSON 5 - Listening (1).pptx",
    folder: "d3c3e8e3c9",
    file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/Ti%E1%BA%BFng%20Anh/LESSON%205%20-%20Listening%20%281%29.pptx",
    file_size: 3034273,
    file_type: "Presentation",
    mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    is_folder: 0,
    creation: "2026-07-16 13:28:10.757303",
    modified: "2026-07-16 13:28:10.892488",
    owner: "Administrator",
    owner_fullname: "Administrator",
    owner_image: null,
    views: 0,
    status: "Active",
    recipients: [],
    tags: ["English", "Lesson"]
  },
  {
    name: "11803bffec",
    file_name: "6366630160986.mp4",
    folder: "09f303b6bf",
    file_url: "/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/6366630160986.mp4",
    file_size: 10401906,
    file_type: "Video",
    mime_type: "video/mp4",
    is_folder: 0,
    creation: "2026-07-16 10:46:44.769656",
    modified: "2026-07-16 10:46:48.797724",
    owner: "Administrator",
    owner_fullname: "Administrator",
    owner_image: null,
    views: 0,
    status: "Active",
    recipients: [],
    tags: ["Video", "Lecture"]
  }
];

const calculateDriveStats = (filesList: typeof mockDriveFiles) => {
  let imagesCount = 0;
  let imagesSize = 0;
  let videosCount = 0;
  let videosSize = 0;
  let documentsCount = 0;
  let documentsSize = 0;
  let otherCount = 0;
  let otherSize = 0;

  filesList.forEach((file) => {
    const typeLower = (file.file_type || '').toLowerCase();
    const mimeLower = (file.mime_type || '').toLowerCase();
    const size = file.file_size || 0;

    if (typeLower === 'image' || mimeLower.includes('image')) {
      imagesCount++;
      imagesSize += size;
    } else if (typeLower === 'video' || mimeLower.includes('video')) {
      videosCount++;
      videosSize += size;
    } else if (
      typeLower === 'document' ||
      typeLower === 'text' ||
      typeLower === 'presentation' ||
      mimeLower.includes('pdf') ||
      mimeLower.includes('word') ||
      mimeLower.includes('document') ||
      mimeLower.includes('sheet') ||
      mimeLower.includes('excel') ||
      mimeLower.includes('text/plain')
    ) {
      documentsCount++;
      documentsSize += size;
    } else {
      otherCount++;
      otherSize += size;
    }
  });

  return {
    Images: { count: imagesCount, size: imagesSize },
    Videos: { count: videosCount, size: videosSize },
    Documents: { count: documentsCount, size: documentsSize },
    Other: { count: otherCount, size: otherSize },
  };
};

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

let mockAgentSettings: any = {
  model: 'gpt-4o',
  model_options: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini'],
  reasoning_effort: 'medium',
  reasoning_effort_options: ['none', 'low', 'medium', 'high'],
  document_input_agent_enabled: true,
  document_input_agent_widget_enabled: true,
  template_agent_enabled: true,
  use_global_llm_config: true,
  llm_config_scope: 'user',
  active_llm_config_scope: 'user',
  can_manage_global_settings: true,
  can_update_user_llm_config: true,
  open_ai_api_key: {
    masked_value: '••••••••••••••••',
    is_configured: true,
    source: 'user',
  },
  proxy_url_llm: {
    value: '',
    is_configured: false,
    source: 'user',
  },
};

let mockVariableSettings: any = {
  render_mode: 'snapshot',
  live_config_draft_only: true,
  editor_style: {
    font_family: 'Times New Roman, Times, serif',
    font_size: '13pt',
    line_height: '1.25',
    color: '#000000',
  },
};

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
    const data = mockDriveFiles.map(file => ({
      name: file.name,
      file_name: file.file_name,
      mime_type: file.mime_type,
      owner: file.owner,
      creation: file.creation,
      modified: file.modified,
      file_size: file.file_size,
      file_url: file.file_url,
      status: file.status || 'Active',
      folder: file.folder,
      views: file.views || 0,
      recipients: file.recipients || [],
      tags: file.tags || [],
      template_type: file.tags.includes('Workflow') ? 'REGULATION' : file.tags.includes('UI') ? 'POLICY' : 'GUIDELINE',
      owner_fullname: file.owner_fullname || file.owner || 'Administrator',
      description: file.file_name.includes('Workflow') ? "Quy trình hướng dẫn thiết lập cấu hình và phê duyệt tài liệu trên hệ thống EDMS." : file.file_name.includes('Screenshot') ? "Hình ảnh chụp màn hình giao diện cấu hình và các bước thực hiện thao tác." : "Sơ yếu lý lịch và hồ sơ năng lực của nhân sự Phan Phạm Quốc Khánh."
    }));
    return HttpResponse.json({
      message: {
        data,
        total: data.length,
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
    const existingDoc = mockDocuments.find((d) => d.id === params.id) as any;
    if (existingDoc) {
      existingDoc.views = (existingDoc.views || 0) + 1;
      const driveFile = mockDriveFiles.find(f => f.name === params.id);
      if (driveFile) {
        driveFile.views = existingDoc.views;
      }
      return HttpResponse.json({ data: existingDoc });
    }

    const driveFile = mockDriveFiles.find(f => f.name === params.id);
    if (driveFile) {
      driveFile.views = (driveFile.views || 0) + 1;
      
      const newDoc = {
        id: driveFile.name,
        title: driveFile.file_name,
        created_by: driveFile.owner_fullname || driveFile.owner || 'Administrator',
        created_at: driveFile.creation,
        updated_at: driveFile.modified,
        is_published: true,
        status: 'PUBLISHED' as any,
        visibility: 'PUBLIC' as any,
        file_url: driveFile.file_url,
        file_size: driveFile.file_size,
        views: driveFile.views,
        recipients: driveFile.recipients || [],
        tags: driveFile.tags || [],
        template: {
          id: `template-${driveFile.name}`,
          name: driveFile.file_name.includes('Workflow') ? 'Workflow Template' : driveFile.file_name.includes('Screenshot') ? 'Screenshot Template' : 'Standard Document Template',
          version: 1,
          status: 'APPROVED',
          template_type: driveFile.file_name.includes('Workflow') ? 'REGULATION' : driveFile.file_name.includes('Screenshot') ? 'POLICY' : 'GUIDELINE',
          artifact_type: driveFile.file_type === 'Video' ? 'video' : 'pdf_form',
          visibility: 'PUBLIC',
          created_by: 'Administrator',
          created_at: driveFile.creation,
          updated_at: driveFile.modified,
          description: 'Mock template for drive files',
          source_file_url: driveFile.file_url,
          source_file_name: driveFile.file_name,
          template_metadata: null,
        },
        permissions: {
          can_edit: true,
          can_delete: true,
          can_submit: false,
          can_approve: false,
          can_reject: false,
          can_publish: false,
          can_unpublish: true,
          can_reset_to_draft: false,
        },
        approval: null
      } as any;
      
      mockDocuments.push(newDoc);
      return HttpResponse.json({ data: newDoc });
    }
    
    return new HttpResponse(null, { status: 404 });
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
      message: calculateDriveStats(mockDriveFiles)
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.university_hub.get_hub_folders'), async ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category') || 'Department';

    const folders = mockDriveFolders.filter(f => f.category === category);
    const data = folders.map(f => {
      const filesInFolder = mockDriveFiles.filter(file => file.folder === f.name);
      return {
        name: f.name,
        file_name: f.file_name,
        modified: f.modified || new Date().toISOString(),
        folder: f.folder,
        owner: f.owner,
        mime_type: f.mime_type,
        owner_fullname: f.owner_fullname,
        owner_image: f.owner_image,
        total_files: filesInFolder.length,
        total_size: filesInFolder.reduce((sum, file) => sum + (file.file_size || 0), 0)
      };
    });

    return HttpResponse.json({
      message: {
        data,
        total: data.length,
        page_size: 10,
        start: 0
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.university_hub.get_recent_activity'), () => {
    const allRecent = [
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
    ];

    const data = allRecent.filter(act => {
      const match = mockDriveFiles.find(file => file.name === act.name || file.file_name === act.file_name);
      if (match) {
        (act as any).file_url = match.file_url;
        // Make sure properties match the found mock file if renamed
        act.name = match.name;
        act.file_name = match.file_name;
        return true;
      }
      return false;
    });

    return HttpResponse.json({
      message: {
        data,
        total: data.length,
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
    const folders = mockDriveFolders.filter(f => f.category === 'MyHub');
    const data = folders.map(f => {
      // Calculate total files and total size for this folder
      const filesInFolder = mockDriveFiles.filter(file => file.folder === f.name);
      return {
        name: f.name,
        file_name: f.file_name,
        folder: f.folder,
        creation: f.creation || f.modified || new Date().toISOString(),
        total_files: filesInFolder.length,
        total_size: filesInFolder.reduce((sum, file) => sum + (file.file_size || 0), 0)
      };
    });
    return HttpResponse.json({
      message: {
        data,
        total: data.length,
        page_size: 20,
        start: 0
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.my_hubs.get_my_files'), () => {
    const data = mockDriveFiles.map(file => ({
      name: file.name,
      file_name: file.file_name,
      modified: file.modified,
      creation: file.creation,
      folder: file.folder || '',
      owner: file.owner,
      mime_type: file.mime_type,
      file_size: file.file_size,
      file_url: file.file_url
    }));
    return HttpResponse.json({
      message: {
        data,
        total: data.length,
        page_size: 10,
        start: 0
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.my_hubs.get_my_recent_activity'), () => {
    // Only return recent activities for files that actually exist in mockDriveFiles!
    const allRecent = [
      {
        name: "70a7750e98",
        file_name: "1. Luồng Cấu hình (Setup Workflow).txt",
        modified: "2026-07-16 13:52:15.763100",
        folder: "09f303b6bf",
        owner: "Administrator",
        mime_type: "text/plain",
        owner_fullname: "Sarah Chen",
        owner_image: null
      },
      {
        name: "f11d6ded4a",
        file_name: "Screenshot 2026-07-15 152114.png",
        modified: "2026-07-16 13:51:13.352771",
        folder: "09f303b6bf",
        owner: "Administrator",
        mime_type: "image/png",
        owner_fullname: "David Wilson",
        owner_image: null
      },
      {
        name: "d2827383e9",
        file_name: "CV_PhanPhamQuocKhanh.pdf",
        modified: "2026-07-16 13:50:50.874084",
        folder: "09f303b6bf",
        owner: "Administrator",
        mime_type: "application/pdf",
        owner_fullname: "Sarah Jenkins",
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
    ];

    const data = allRecent.filter(act => {
      const match = mockDriveFiles.find(file => file.name === act.name);
      if (match) {
        (act as any).file_url = match.file_url;
        return true;
      }
      return false;
    });

    return HttpResponse.json({
      message: {
        data,
        total: data.length,
        page_size: 10,
        start: 0
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.my_hubs.get_my_stats'), () => {
    return HttpResponse.json({
      message: calculateDriveStats(mockDriveFiles)
    });
  }),

  http.get(getApiUrl('/api/v1/my-hubs/folders'), () => {
    const folders = mockDriveFolders.filter(f => f.category === 'MyHub').map(f => {
      const filesInFolder = mockDriveFiles.filter(file => file.folder === f.name);
      
      const formatBytesLocal = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      return {
        id: f.name,
        name: f.file_name,
        size: formatBytesLocal(filesInFolder.reduce((sum, file) => sum + (file.file_size || 0), 0)),
        filesCount: filesInFolder.length
      };
    });
    return HttpResponse.json({ data: folders });
  }),

  http.post(getApiUrl('/api/v1/my-hubs/folders'), async ({ request }) => {
    const payload = (await request.json()) as any;
    const newFolder = {
      name: `folder-${Date.now()}`,
      file_name: payload.name || 'New Folder',
      folder: null,
      creation: new Date().toISOString(),
      modified: new Date().toISOString(),
      owner: "Administrator",
      mime_type: "Folder",
      owner_fullname: "Administrator",
      owner_image: null,
      category: "MyHub"
    };
    mockDriveFolders.push(newFolder);
    return HttpResponse.json({
      data: {
        id: newFolder.name,
        name: newFolder.file_name,
        size: '0 B',
        filesCount: 0
      }
    });
  }),

  http.delete(getApiUrl('/api/v1/my-hubs/folders/:id'), ({ params }) => {
    mockDriveFolders = mockDriveFolders.filter((f) => f.name !== params.id);
    return HttpResponse.json({ success: true });
  }),

  http.get(getApiUrl('/api/v1/my-hubs/files'), () => {
    const formatBytesLocal = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const files = mockDriveFiles.map(file => {
      const mapFileTypeLocal = (mimeType: string, fileName?: string): 'pdf' | 'docx' | 'xlsx' | 'other' => {
        const mimeLower = mimeType.toLowerCase();
        if (mimeLower.includes('pdf')) return 'pdf';
        if (mimeLower.includes('word') || mimeLower.includes('document') || mimeLower.includes('text/plain')) return 'docx';
        if (mimeLower.includes('sheet') || mimeLower.includes('excel') || mimeLower.includes('spreadsheet')) return 'xlsx';
        if (fileName) {
          const ext = fileName.split('.').pop()?.toLowerCase();
          if (ext === 'pdf') return 'pdf';
          if (ext === 'docx' || ext === 'doc' || ext === 'txt') return 'docx';
          if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
        }
        return 'other';
      };

      return {
        id: file.name,
        name: file.file_name,
        size: formatBytesLocal(file.file_size),
        fileType: mapFileTypeLocal(file.mime_type, file.file_name),
        fileUrl: file.file_url || null
      };
    });
    return HttpResponse.json({ data: files });
  }),

  http.post(getApiUrl('/api/v1/my-hubs/files'), async ({ request }) => {
    const payload = (await request.json()) as any;
    
    let file_size = 102400; // 100 KB default
    if (payload.size) {
      const match = payload.size.match(/^([\d.]+)\s*(\w+)/);
      if (match) {
        const val = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        if (unit.startsWith('K')) file_size = val * 1024;
        else if (unit.startsWith('M')) file_size = val * 1024 * 1024;
        else if (unit.startsWith('G')) file_size = val * 1024 * 1024 * 1024;
        else file_size = val;
      }
    }

    const newFile = {
      name: `file-${Date.now()}`,
      file_name: payload.name || 'New File',
      folder: "09f303b6bf", // Main folder
      file_url: `/api/method/drive.api.s3.fetch?path=Administrator%20%28Administrator%29/${encodeURIComponent(payload.name || 'New File')}`,
      file_size: file_size,
      file_type: payload.fileType || 'pdf',
      mime_type: payload.fileType === 'pdf' ? 'application/pdf' : payload.fileType === 'xlsx' ? 'application/vnd.ms-excel' : 'application/msword',
      is_folder: 0,
      creation: new Date().toISOString(),
      modified: new Date().toISOString(),
      owner: "Administrator",
      owner_fullname: activeProfile.first_name + " " + (activeProfile.last_name || ""),
      owner_image: null,
      views: 0,
      status: 'PUBLISHED',
      recipients: [] as string[],
      tags: [] as string[]
    };
    mockDriveFiles.push(newFile);

    return HttpResponse.json({
      data: {
        id: newFile.name,
        name: newFile.file_name,
        size: payload.size || '100 KB',
        fileType: payload.fileType || 'pdf',
        fileUrl: newFile.file_url
      }
    });
  }),

  http.delete(getApiUrl('/api/v1/my-hubs/files/:id'), ({ params }) => {
    mockDriveFiles = mockDriveFiles.filter((f) => f.name !== params.id);
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
    const sorted = [...mockDriveFiles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3);
    const data = sorted.map(file => ({
      name: file.name,
      file_name: file.file_name,
      mime_type: file.mime_type,
      owner: file.owner_fullname || file.owner || 'Administrator',
      creation: file.creation,
      views: file.views || 0,
      file_url: file.file_url
    }));
    return HttpResponse.json({ message: data });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.dashboard.summary_stats'), () => {
    const published_files = mockDocuments.filter(d => d.is_published || d.status === 'PUBLISHED').length;
    const my_files = mockDriveFiles.length;
    return HttpResponse.json({
      message: {
        published_files,
        my_files,
        sharing_files: 0
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.dashboard.engagement'), () => {
    const totalViews = mockDriveFiles.reduce((sum, f) => sum + (f.views || 0), 0);
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      let views = 0;
      if (i === 0) views = Math.max(3, totalViews);
      else if (i === 1) views = Math.round(totalViews * 0.8) || 5;
      else if (i === 2) views = Math.round(totalViews * 0.5) || 3;
      else views = Math.max(1, 6 - i);
      
      data.push({
        date: dateStr,
        views
      });
    }
    return HttpResponse.json({
      message: data
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.dashboard.file_distribution'), () => {
    const stats = calculateDriveStats(mockDriveFiles);
    return HttpResponse.json({
      message: {
        Documents: stats.Documents.count,
        Images: stats.Images.count,
        Videos: stats.Videos.count,
        Others: stats.Other.count
      }
    });
  }),

  http.get(getApiUrl('/api/method/drive_edms.api.dashboard.documents_latest'), () => {
    const sorted = [...mockDriveFiles].sort((a, b) => new Date(b.creation).getTime() - new Date(a.creation).getTime());
    const message = sorted.map(file => ({
      name: file.name,
      file_name: file.file_name,
      folder: file.folder,
      file_url: file.file_url,
      file_size: file.file_size,
      file_type: file.file_type,
      is_folder: 0,
      content_doctype: null,
      content_docname: null,
      team: "evjem9pjqi",
      creation: file.creation,
      modified: file.modified,
      owner: file.owner,
      owner_full_name: file.owner_fullname || file.owner || "Administrator",
      owner_image: file.owner_image,
      is_favourite: null,
      accessed: file.modified,
      child_count: 0,
      share_count: 0,
      kind: "native",
      read: 1,
      comment: 1,
      share: 1,
      upload: 1,
      write: 1,
      type: "admin"
    }));
    return HttpResponse.json({ message });
  }),

  // --- PROFILE ---
  http.get(getApiUrl('/api/method/drive_edms.api.profile.get_profile_dashboard'), () => {
    const stats = calculateDriveStats(mockDriveFiles);
    const baseDocBytes = 2.8 * 1024 * 1024 * 1024 * 1024;
    const baseMediaBytes = 1.4 * 1024 * 1024 * 1024 * 1024;
    
    const docBytes = baseDocBytes + stats.Documents.size;
    const mediaBytes = baseMediaBytes + stats.Videos.size + stats.Images.size;
    const usedBytes = docBytes + mediaBytes;
    const limitBytes = 10 * 1024 * 1024 * 1024 * 1024; // 10 TB limit
    
    const docPercentage = Math.round((docBytes / usedBytes) * 100);
    const mediaPercentage = Math.round((mediaBytes / usedBytes) * 100);

    return HttpResponse.json({
      message: {
        user_info: {
          first_name: activeProfile.first_name,
          last_name: activeProfile.last_name || null,
          full_name: `${activeProfile.first_name} ${activeProfile.last_name || ''}`.trim(),
          email: activeProfile.email,
          phone: activeProfile.phone_number || null,
          employee_id: activeProfile.id,
          department: "Information Management",
          bio: activeProfile.expertise[0] || null,
          campus: "Main Campus",
          role: activeProfile.job,
          user_image: activeProfile.profile_url || null
        },
        storage: {
          used_bytes: usedBytes,
          limit_bytes: limitBytes,
          percentage_used: Math.round((usedBytes / limitBytes) * 100),
          categories: {
            documents: {
              bytes: docBytes,
              percentage: docPercentage
            },
            media: {
              bytes: mediaBytes,
              percentage: mediaPercentage
            }
          }
        },
        recent_activity: [
          {
            title: `${activeProfile.first_name} logged in`,
            type: "Security",
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            icon: "security"
          },
          {
            title: "Accessed '1. Luồng Cấu hình (Setup Workflow).txt'",
            type: "Document",
            time: "2026-07-16 17:43:55.362297",
            icon: "document"
          },
          {
            title: "Accessed 'Screenshot 2026-07-15 152114.png'",
            type: "Document",
            time: "2026-07-16 16:51:32.104165",
            icon: "document"
          }
        ]
      }
    });
  }),

  http.put(getApiUrl('/api/method/drive_edms.api.profile.update_profile'), async ({ request }) => {
    const body = (await request.json()) as any;
    if (body.first_name) activeProfile.first_name = body.first_name;
    if (body.last_name !== undefined) activeProfile.last_name = body.last_name;
    if (body.bio) activeProfile.expertise = [body.bio];
    if (body.phone) activeProfile.phone_number = body.phone;
    
    return HttpResponse.json({
      message: {
        status: "success",
        message: "Profile updated successfully",
        data_received: {
          phone: body.phone,
          bio: body.bio,
          first_name: body.first_name,
          last_name: body.last_name
        }
      }
    });
  }),

  // --- DRIVE ACTIONS ---
  http.get(getApiUrl('/api/method/drive.api.list.files'), ({ request }) => {
    const url = new URL(request.url);
    const entity_name = url.searchParams.get('entity_name');
    
    // Filter folders and files belonging to this entity_name parent folder!
    const subfolders = mockDriveFolders
      .filter(f => f.folder === entity_name)
      .map(f => ({
        name: f.name,
        file_name: f.file_name,
        folder: f.folder,
        file_url: null,
        file_size: 0,
        file_type: "Folder",
        is_folder: 1,
        content_doctype: null,
        content_docname: null,
        team: "evjem9pjqi",
        creation: f.creation || f.modified || new Date().toISOString(),
        modified: f.modified || new Date().toISOString(),
        owner: f.owner,
        owner_full_name: f.owner_fullname || f.owner || "Administrator",
        owner_image: f.owner_image,
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
      }));
      
    const files = mockDriveFiles
      .filter(file => file.folder === entity_name)
      .map(file => ({
        name: file.name,
        file_name: file.file_name,
        folder: file.folder,
        file_url: file.file_url,
        file_size: file.file_size,
        file_type: file.file_type,
        is_folder: 0,
        content_doctype: null,
        content_docname: null,
        team: "evjem9pjqi",
        creation: file.creation,
        modified: file.modified,
        owner: file.owner,
        owner_full_name: file.owner_fullname || file.owner || "Administrator",
        owner_image: file.owner_image,
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
      }));
      
    return HttpResponse.json({
      message: [...subfolders, ...files]
    });
  }),

  http.post(getApiUrl('/api/method/drive.api.files.rename'), async ({ request }) => {
    const payload = (await request.json()) as { entity_name: string; new_title: string };
    if (payload) {
      // Find in files
      const fIdx = mockDriveFiles.findIndex((f) => f.name === payload.entity_name);
      if (fIdx !== -1) {
        mockDriveFiles[fIdx].file_name = payload.new_title;
        mockDriveFiles[fIdx].modified = new Date().toISOString();
      }
      // Find in folders
      const foldIdx = mockDriveFolders.findIndex((f) => f.name === payload.entity_name);
      if (foldIdx !== -1) {
        mockDriveFolders[foldIdx].file_name = payload.new_title;
        mockDriveFolders[foldIdx].modified = new Date().toISOString();
      }
    }
    return HttpResponse.json({});
  }),

  http.post(getApiUrl('/api/method/drive.api.files.move'), async ({ request }) => {
    const payload = (await request.json()) as { entity_names: string[]; new_parent: string };
    if (payload && payload.entity_names) {
      payload.entity_names.forEach((name) => {
        const fIdx = mockDriveFiles.findIndex((f) => f.name === name);
        if (fIdx !== -1) {
          mockDriveFiles[fIdx].folder = payload.new_parent;
          mockDriveFiles[fIdx].modified = new Date().toISOString();
        }
        const foldIdx = mockDriveFolders.findIndex((f) => f.name === name);
        if (foldIdx !== -1) {
          mockDriveFolders[foldIdx].folder = payload.new_parent;
          mockDriveFolders[foldIdx].modified = new Date().toISOString();
        }
      });
    }
    return HttpResponse.json({
      message: {
        file_name: "Moved",
        team: "evjem9pjqi",
        name: payload?.entity_names?.[0] || "",
        folder: payload?.new_parent || ""
      }
    });
  }),

  http.post(getApiUrl('/api/method/drive.api.files.update_access'), () => {
    return HttpResponse.json({});
  }),

  http.post(getApiUrl('/api/method/drive.api.files.remove_or_restore'), async ({ request }) => {
    const payload = (await request.json()) as { entity_names: string[] };
    if (payload && payload.entity_names) {
      mockDriveFiles = mockDriveFiles.filter((f) => !payload.entity_names.includes(f.name));
      mockDriveFolders = mockDriveFolders.filter((f) => !payload.entity_names.includes(f.name));
    }
    return HttpResponse.json({});
  }),

  // --- TEMPLATES ---
  http.get(getApiUrl('/api/v1/templates/document-input-agent/settings'), () => {
    return HttpResponse.json({ data: mockAgentSettings });
  }),

  http.patch(getApiUrl('/api/v1/templates/document-input-agent/settings'), async ({ request }) => {
    const payload = (await request.json()) as any;
    mockAgentSettings = {
      ...mockAgentSettings,
      ...payload,
    };
    return HttpResponse.json({ data: mockAgentSettings });
  }),

  http.get(getApiUrl('/api/v1/templates/template-variables/settings'), () => {
    return HttpResponse.json({ data: mockVariableSettings });
  }),

  http.patch(getApiUrl('/api/v1/templates/template-variables/settings'), async ({ request }) => {
    const payload = (await request.json()) as any;
    mockVariableSettings = {
      ...mockVariableSettings,
      ...payload,
    };
    return HttpResponse.json({ data: mockVariableSettings });
  }),
];

