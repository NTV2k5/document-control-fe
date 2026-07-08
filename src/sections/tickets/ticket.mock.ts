import {
  ETicketType,
  ETicketStatus,
  ETicketSource,
  EPaymentStatus,
  EProcessingForm,
  EStepStatus,
  type ITicket,
  type IPerson,
  type ITicketStatsCard,
  type ITicketStep,
  type IApprovalLevel,
} from './ticket.type';


/* ─── People ─────────────────────────────────────────────── */

const people: Record<string, IPerson> = {
  nguyenVanAn: {
    id: 'p1',
    name: 'Nguyễn Văn An',
    mssv: '2174801000',
    role: 'Sinh viên',
    department: 'Khoa CNTT',
  },
  tranMinhKhoi: {
    id: 'p2',
    name: 'Trần Minh Khôi',
    mssv: '2174801050',
    role: 'Sinh viên',
    department: 'Khoa Kinh tế',
  },
  phamThuHa: {
    id: 'p3',
    name: 'Phạm Thu Hà',
    mssv: '2174801220',
    role: 'Sinh viên',
    department: 'Khoa Luật',
  },
  voQuocHuy: {
    id: 'p4',
    name: 'Võ Quốc Huy',
    mssv: '2174801066',
    role: 'Sinh viên',
    department: 'Khoa CNTT',
  },
  ngoThanhTung: {
    id: 'p5',
    name: 'Ngô Thanh Tùng',
    mssv: '2174801300',
    role: 'Sinh viên',
    department: 'Khoa Ngoại ngữ',
  },
  hoangAnhTu: {
    id: 'p6',
    name: 'Hoàng Anh Tú',
    mssv: '2174801410',
    role: 'Sinh viên',
    department: 'Khoa Kinh tế',
  },
  tranThiMai: {
    id: 's1',
    name: 'Trần Thị Mai',
    role: 'Cán bộ Phòng Đào tạo',
    department: 'Phòng Đào tạo',
  },
  nguyenVanSon: {
    id: 's2',
    name: 'Nguyễn Văn Sơn',
    role: 'Cán bộ Khoa CNTT',
    department: 'Khoa CNTT',
  },
  leHoangNam: {
    id: 's3',
    name: 'Lê Hoàng Nam',
    role: 'Cán bộ Khoa CNTT',
    department: 'Khoa CNTT',
  },
  truongPhongDaoTao: {
    id: 's4',
    name: 'PGS.TS Lê Văn Hùng',
    role: 'Trưởng phòng Đào tạo',
    department: 'Phòng Đào tạo',
  },
};

/* ─── Helper: Build CCTT steps (4 steps) ─────────────────── */

const buildCCTTSteps = (
  assignee: IPerson,
  status: 'all_done' | 'step2' | 'step3' | 'new',
): ITicketStep[] => {
  const now = new Date();
  const steps: ITicketStep[] = [
    {
      id: 'cctt-1',
      order: 1,
      name: 'Tiếp nhận & phân công',
      performer: 'Hệ thống',
      performerType: 'system',
      status: EStepStatus.DA_XONG,
      completedAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
      description: 'Hệ thống tự động phân ticket về cán bộ phụ trách.',
      resultSummary: 'Đã phân công cho ' + assignee.name,
      icon: 'clipboard-check',
      comments: [],
    },
    {
      id: 'cctt-2',
      order: 2,
      name: 'Gọi sinh viên qua GDU360 / di động',
      performer: assignee.name,
      performerType: 'staff',
      status: status === 'new' ? EStepStatus.CHUA_TOI : status === 'step2' ? EStepStatus.DANG_CHO : EStepStatus.DA_XONG,
      completedAt: status === 'all_done' || status === 'step3' ? new Date(now.getTime() - 86400000).toISOString() : undefined,
      description: 'Liên hệ sinh viên qua GDU360 hoặc số di động để trao đổi trực tiếp.',
      resultSummary: status === 'all_done' || status === 'step3' ? 'Đã gọi điện và trao đổi thành công.' : undefined,
      icon: 'phone',
      callNote: status === 'all_done' || status === 'step3' ? 'Sinh viên đã nắm được thông tin cần thiết.' : undefined,
      comments: [],
    },
    {
      id: 'cctt-3',
      order: 3,
      name: 'Cập nhật kết quả phản hồi',
      performer: assignee.name,
      performerType: 'staff',
      status: status === 'all_done' ? EStepStatus.DA_XONG : status === 'step3' ? EStepStatus.DANG_CHO : EStepStatus.CHUA_TOI,
      completedAt: status === 'all_done' ? new Date(now.getTime() - 43200000).toISOString() : undefined,
      description: 'Ghi nhận kết quả sau khi trao đổi với sinh viên.',
      resultSummary: status === 'all_done' ? 'Đã lưu kết quả phản hồi thành công.' : undefined,
      icon: 'file-text',
      feedbackNote: status === 'all_done' ? 'Sinh viên hài lòng với kết quả trao đổi.' : undefined,
      comments: [],
    },
    {
      id: 'cctt-4',
      order: 4,
      name: 'Đóng ticket',
      performer: assignee.name,
      performerType: 'staff',
      status: status === 'all_done' ? EStepStatus.DA_XONG : EStepStatus.CHUA_TOI,
      completedAt: status === 'all_done' ? new Date(now.getTime() - 3600000).toISOString() : undefined,
      description: 'Đóng ticket và chuyển trạng thái "Đã hoàn tất".',
      resultSummary: status === 'all_done' ? 'Ticket đã được đóng thành công.' : undefined,
      icon: 'check-circle',
      comments: [],
    },
  ];
  return steps;
};


/* ─── Helper: Build DVHC steps (6–8 steps) ───────────────── */

const buildDVHCSteps = (
  assignee: IPerson,
  hasFee: boolean,
  form: EProcessingForm,
  currentStep: number,
  documentCode?: string,
): ITicketStep[] => {
  const now = new Date();
  const steps: ITicketStep[] = [];
  let order = 0;

  // Step 1: Tiếp nhận yêu cầu · xác thực OTP (luôn có, auto-step)
  order++;
  steps.push({
    id: 'dvhc-1',
    order,
    name: 'Tiếp nhận yêu cầu · xác thực OTP',
    performer: 'Hệ thống',
    performerType: 'system',
    status: EStepStatus.DA_XONG,
    completedAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
    description: 'Hệ thống tự động xác thực OTP và tiếp nhận yêu cầu.',
    resultSummary: 'Đã xác thực OTP - thông tin sinh viên hợp lệ.',
    icon: 'shield-check',
    comments: [],
  });

  // Step 2: Thanh toán QR (chỉ khi có phí)
  if (hasFee) {
    order++;
    steps.push({
      id: 'dvhc-2',
      order,
      name: 'Thanh toán QR · ticket tự tạo',
      performer: 'Hệ thống',
      performerType: 'system',
      status: currentStep > order ? EStepStatus.DA_XONG : currentStep === order ? EStepStatus.DANG_CHO : EStepStatus.CHUA_TOI,
      completedAt: currentStep > order ? new Date(now.getTime() - 86400000 * 2.5).toISOString() : undefined,
      description: 'Sinh viên thanh toán qua mã QR ngân hàng.',
      resultSummary: currentStep > order ? 'Đã thu 50.000đ qua QR ngân hàng - giao dịch thành công.' : undefined,
      icon: 'credit-card',
      isStudentAction: true,
      paymentInfo: {
        amount: 50000,
        bank: 'Vietcombank',
        accountNumber: '1234567890',
        accountHolder: 'Trường ĐH Gia Định',
        transferContent: `SV-2041 ${assignee.mssv || '2174801000'}`,
      },
      comments: [],
    });
  }

  // Step 3: Tạo Phiếu thông tin văn bản & Đơn từ (luôn có)
  order++;
  steps.push({
    id: 'dvhc-3',
    order,
    name: 'Tạo Phiếu thông tin văn bản & Đơn từ',
    performer: assignee.name,
    performerType: 'staff',
    status: currentStep > order ? EStepStatus.DA_XONG : currentStep === order ? EStepStatus.DANG_CHO : EStepStatus.CHUA_TOI,
    completedAt: currentStep > order ? new Date(now.getTime() - 86400000 * 2).toISOString() : undefined,
    description: 'Cán bộ tạo Phiếu thông tin văn bản để xử lý yêu cầu.',
    resultSummary: currentStep > order ? `Đã tạo Đơn từ từ Phiếu ${documentCode || 'PVB-002'}.` : undefined,
    icon: 'file-plus',
    comments: [],
  });

  // Step 4: Quy trình phê duyệt đơn từ (luôn có)
  order++;
  steps.push({
    id: 'dvhc-4',
    order,
    name: 'Quy trình phê duyệt đơn từ',
    performer: assignee.name,
    performerType: 'staff',
    status: currentStep > order ? EStepStatus.DA_XONG : currentStep === order ? EStepStatus.DANG_CHO : EStepStatus.CHUA_TOI,
    completedAt: currentStep > order ? new Date(now.getTime() - 86400000).toISOString() : undefined,
    description: 'Đơn từ được chuyển qua các cấp phê duyệt theo luồng đã cấu hình của Phiếu.',
    icon: 'git-branch',
    approvalLevels: [
      {
        id: 'al-1',
        label: 'Trưởng khoa duyệt',
        approver: people.truongPhongDaoTao,
        status: (currentStep > order ? 'approved' : currentStep === order ? 'pending' : 'waiting') as 'approved' | 'pending' | 'waiting',
        approvedAt: currentStep > order ? new Date(now.getTime() - 86400000 * 1.5).toISOString() : undefined,
      },
    ],
    comments: [],
  });

  // Step 5: Chuẩn bị bản cứng (chỉ khi Offline)
  if (form === EProcessingForm.OFFLINE_KY_TAY) {
    order++;
    steps.push({
      id: 'dvhc-5',
      order,
      name: 'Chuẩn bị bản cứng (in, ký tay, đóng dấu)',
      performer: assignee.name,
      performerType: 'staff',
      status: currentStep > order ? EStepStatus.DA_XONG : currentStep === order ? EStepStatus.DANG_CHO : EStepStatus.CHUA_TOI,
      completedAt: currentStep > order ? new Date(now.getTime() - 43200000).toISOString() : undefined,
      description: 'Cán bộ in, ký tay và đóng dấu bản cứng.',
      icon: 'printer',
      comments: [],
    });
  }

  // Step 6: Gửi file cho sinh viên / Gửi thông báo đến nhận (luôn có)
  order++;
  const sendStepName =
    form === EProcessingForm.OFFLINE_KY_TAY
      ? 'Gửi thông báo đến nhận bản cứng'
      : form === EProcessingForm.ONLINE_BAN_SCAN
        ? 'Gửi file scan cho sinh viên'
        : 'Gửi file ký số cho sinh viên';
  steps.push({
    id: 'dvhc-6',
    order,
    name: sendStepName,
    performer: assignee.name,
    performerType: 'staff',
    status: currentStep > order ? EStepStatus.DA_XONG : currentStep === order ? EStepStatus.DANG_CHO : EStepStatus.CHUA_TOI,
    completedAt: currentStep > order ? new Date(now.getTime() - 21600000).toISOString() : undefined,
    description:
      form === EProcessingForm.ONLINE_BAN_SCAN
        ? 'Upload file scan trước khi gửi email cho sinh viên.'
        : 'Gửi file hoặc thông báo cho sinh viên.',
    icon: 'send',
    comments: [],
  });

  // Step 7: Sinh viên xác nhận đã nhận file/hồ sơ (luôn có)
  order++;
  steps.push({
    id: 'dvhc-7',
    order,
    name: 'Sinh viên xác nhận đã nhận file/hồ sơ',
    performer: 'Sinh viên',
    performerType: 'student',
    status: currentStep > order ? EStepStatus.DA_XONG : currentStep === order ? EStepStatus.DANG_CHO : EStepStatus.CHUA_TOI,
    completedAt: currentStep > order ? new Date(now.getTime() - 7200000).toISOString() : undefined,
    description: 'Sinh viên xác nhận đã nhận được file hoặc hồ sơ.',
    icon: 'user-check',
    isStudentAction: true,
    comments: [],
  });

  // Step 8: Đóng ticket (luôn có)
  order++;
  steps.push({
    id: 'dvhc-8',
    order,
    name: 'Đóng ticket',
    performer: assignee.name,
    performerType: 'staff',
    status: currentStep > order ? EStepStatus.DA_XONG : currentStep === order ? EStepStatus.DANG_CHO : EStepStatus.CHUA_TOI,
    completedAt: currentStep > order ? new Date(now.getTime() - 3600000).toISOString() : undefined,
    description: 'Đóng ticket và chuyển trạng thái "Đã hoàn tất".',
    icon: 'check-circle',
    comments: [],
  });

  return steps;
};


/* ─── Mock Tickets ───────────────────────────────────────── */

export const mockTickets: ITicket[] = [
  {
    id: 't1',
    code: 'SV-2041',
    title: 'Đơn xin chuyển ngành học',
    content: 'Em muốn chuyển từ ngành Quản trị kinh doanh sang Công nghệ thông tin. Mong Nhà trường xem xét và hướng dẫn thủ tục.',
    student: people.nguyenVanAn,
    type: ETicketType.DICH_VU_HANH_CHINH,
    creator: people.nguyenVanAn,
    createdAt: '2026-06-22T14:02:00',
    source: ETicketSource.TAO_TICKET,
    documentCode: 'PVB-802',
    processingForm: EProcessingForm.ONLINE_KY_SO,
    hasFee: true,
    paymentStatus: EPaymentStatus.DA_THANH_TOAN,
    feeAmount: 50000,
    assignee: people.tranThiMai,
    supporters: [people.nguyenVanSon, people.leHoangNam],
    notifyRecipients: [people.nguyenVanAn, people.truongPhongDaoTao],
    deadline: '2026-06-29T17:00:00',
    status: ETicketStatus.DANG_XU_LY,
    slaPercent: 65,
    slaLabel: 'Còn 2 ngày',
    attachments: ['don-xin-chuyen-nganh.pdf'],
    steps: buildDVHCSteps(people.tranThiMai, true, EProcessingForm.ONLINE_KY_SO, 5, 'PVB-802'),
  },
  {
    id: 't2',
    code: 'TC-118',
    title: 'Xin đóng học phí theo đợt',
    content: 'Em muốn đóng học phí theo từng đợt do hoàn cảnh gia đình khó khăn. Mong Nhà trường xem xét.',
    student: people.tranMinhKhoi,
    type: ETicketType.CUNG_CAP_THONG_TIN,
    creator: people.tranMinhKhoi,
    createdAt: '2026-06-23T08:40:00',
    source: ETicketSource.AI_CHATBOT,
    processingForm: EProcessingForm.GOI_DIEN_KHAC,
    hasFee: false,
    paymentStatus: EPaymentStatus.KHONG_THU_PHI,
    assignee: people.tranThiMai,
    supporters: [],
    notifyRecipients: [people.tranMinhKhoi],
    deadline: '2026-06-25T17:00:00',
    status: ETicketStatus.DANG_XU_LY,
    slaPercent: 40,
    slaLabel: 'Còn 8 giờ',
    attachments: [],
    steps: buildCCTTSteps(people.tranThiMai, 'step2'),
  },
  {
    id: 't3',
    code: 'SV-2052',
    title: 'Cấp bảng điểm có dấu',
    content: 'Em cần cấp bảng điểm có dấu để nộp hồ sơ xin việc. Xin hãy hướng dẫn thủ tục.',
    student: people.phamThuHa,
    type: ETicketType.DICH_VU_HANH_CHINH,
    creator: people.phamThuHa,
    createdAt: '2026-06-21T10:20:00',
    source: ETicketSource.TAO_TICKET,
    documentCode: 'PVB-803',
    processingForm: EProcessingForm.OFFLINE_KY_TAY,
    hasFee: true,
    paymentStatus: EPaymentStatus.DA_THANH_TOAN,
    feeAmount: 50000,
    assignee: people.tranThiMai,
    supporters: [],
    notifyRecipients: [people.phamThuHa],
    deadline: '2026-06-28T17:00:00',
    status: ETicketStatus.DANG_XU_LY,
    slaPercent: 50,
    slaLabel: 'Còn 3 ngày',
    attachments: ['yeu-cau-bang-diem.pdf'],
    steps: buildDVHCSteps(people.tranThiMai, true, EProcessingForm.OFFLINE_KY_TAY, 4, 'PVB-803'),
  },
  {
    id: 't4',
    code: 'CN-977',
    title: 'Phúc khảo điểm Lập trình Web',
    content: 'Em muốn phúc khảo điểm thi môn Lập trình Web, kỳ thi HK2 2025-2026. Em cảm thấy điểm chưa chính xác.',
    student: people.voQuocHuy,
    type: ETicketType.DICH_VU_HANH_CHINH,
    creator: people.voQuocHuy,
    createdAt: '2026-06-20T16:05:00',
    source: ETicketSource.TAO_TICKET,
    documentCode: 'PVB-804',
    processingForm: EProcessingForm.ONLINE_BAN_SCAN,
    hasFee: false,
    paymentStatus: EPaymentStatus.KHONG_THU_PHI,
    assignee: people.nguyenVanSon,
    supporters: [people.leHoangNam],
    notifyRecipients: [people.voQuocHuy],
    deadline: '2026-06-27T17:00:00',
    status: ETicketStatus.CHO_SINH_VIEN,
    slaPercent: 85,
    slaLabel: 'Còn 1 ngày',
    attachments: ['phieu-phuc-khao.pdf'],
    steps: buildDVHCSteps(people.nguyenVanSon, false, EProcessingForm.ONLINE_BAN_SCAN, 7, 'PVB-804'),
  },
  {
    id: 't5',
    code: 'SV-2061',
    title: 'Đơn bảo lưu kết quả học tập',
    content: 'Em muốn bảo lưu kết quả học tập kỳ HK1 2026-2027 do lý do sức khỏe.',
    student: people.ngoThanhTung,
    type: ETicketType.DICH_VU_HANH_CHINH,
    creator: people.ngoThanhTung,
    createdAt: '2026-06-24T10:15:00',
    source: ETicketSource.AI_CHATBOT,
    documentCode: 'PVB-805',
    processingForm: EProcessingForm.ONLINE_KY_SO,
    hasFee: true,
    paymentStatus: EPaymentStatus.CHUA_THANH_TOAN,
    feeAmount: 30000,
    assignee: people.tranThiMai,
    supporters: [],
    notifyRecipients: [people.ngoThanhTung],
    deadline: '2026-07-01T17:00:00',
    status: ETicketStatus.MOI,
    slaPercent: 10,
    slaLabel: 'Còn 5 ngày',
    attachments: ['don-bao-luu.pdf'],
    steps: buildDVHCSteps(people.tranThiMai, true, EProcessingForm.ONLINE_KY_SO, 2, 'PVB-805'),
  },
  {
    id: 't6',
    code: 'SV-2073',
    title: 'Giấy giới thiệu thực tập',
    content: 'Em cần giấy giới thiệu thực tập cho kỳ thực tập HK2 2025-2026 tại công ty ABC.',
    student: people.hoangAnhTu,
    type: ETicketType.DICH_VU_HANH_CHINH,
    creator: people.hoangAnhTu,
    createdAt: '2026-06-26T09:20:00',
    source: ETicketSource.TAO_TICKET,
    documentCode: 'PVB-806',
    processingForm: EProcessingForm.ONLINE_KY_SO,
    hasFee: false,
    paymentStatus: EPaymentStatus.KHONG_THU_PHI,
    assignee: people.tranThiMai,
    supporters: [],
    notifyRecipients: [people.hoangAnhTu],
    deadline: '2026-07-03T17:00:00',
    status: ETicketStatus.DA_HOAN_TAT,
    slaPercent: 100,
    slaLabel: 'Đạt SLA',
    attachments: ['giay-gioi-thieu.pdf'],
    steps: buildDVHCSteps(people.tranThiMai, false, EProcessingForm.ONLINE_KY_SO, 99, 'PVB-806'),
  },
  // Additional tickets for pagination demo
  {
    id: 't7',
    code: 'TC-125',
    title: 'Hỏi thông tin học bổng khuyến khích',
    content: 'Em muốn hỏi về điều kiện nhận học bổng khuyến khích học tập HK1 2026-2027.',
    student: people.nguyenVanAn,
    type: ETicketType.CUNG_CAP_THONG_TIN,
    creator: people.nguyenVanAn,
    createdAt: '2026-06-25T11:30:00',
    source: ETicketSource.AI_CHATBOT,
    processingForm: EProcessingForm.GOI_DIEN_KHAC,
    hasFee: false,
    paymentStatus: EPaymentStatus.KHONG_THU_PHI,
    assignee: people.tranThiMai,
    supporters: [],
    notifyRecipients: [people.nguyenVanAn],
    deadline: '2026-06-27T17:00:00',
    status: ETicketStatus.DA_HOAN_TAT,
    slaPercent: 100,
    slaLabel: 'Đạt SLA',
    attachments: [],
    steps: buildCCTTSteps(people.tranThiMai, 'all_done'),
  },
  {
    id: 't8',
    code: 'TC-130',
    title: 'Hỏi lịch thi lại môn Toán cao cấp',
    content: 'Em muốn biết lịch thi lại môn Toán cao cấp 2 HK2.',
    student: people.phamThuHa,
    type: ETicketType.CUNG_CAP_THONG_TIN,
    creator: people.phamThuHa,
    createdAt: '2026-06-27T14:00:00',
    source: ETicketSource.TAO_TICKET,
    processingForm: EProcessingForm.GOI_DIEN_KHAC,
    hasFee: false,
    paymentStatus: EPaymentStatus.KHONG_THU_PHI,
    assignee: people.nguyenVanSon,
    supporters: [],
    notifyRecipients: [people.phamThuHa],
    deadline: '2026-06-30T17:00:00',
    status: ETicketStatus.DANG_XU_LY,
    slaPercent: 30,
    slaLabel: 'Còn 1 ngày',
    attachments: [],
    steps: buildCCTTSteps(people.nguyenVanSon, 'step3'),
  },
  {
    id: 't9',
    code: 'SV-2080',
    title: 'Đơn xin miễn môn Tiếng Anh',
    content: 'Em có chứng chỉ IELTS 7.0, muốn xin miễn học môn Tiếng Anh cơ bản.',
    student: people.voQuocHuy,
    type: ETicketType.DICH_VU_HANH_CHINH,
    creator: people.voQuocHuy,
    createdAt: '2026-06-28T08:00:00',
    source: ETicketSource.TAO_TICKET,
    documentCode: 'PVB-807',
    processingForm: EProcessingForm.ONLINE_KY_SO,
    hasFee: false,
    paymentStatus: EPaymentStatus.KHONG_THU_PHI,
    assignee: people.tranThiMai,
    supporters: [people.leHoangNam],
    notifyRecipients: [people.voQuocHuy],
    deadline: '2026-07-05T17:00:00',
    status: ETicketStatus.MOI,
    slaPercent: 5,
    slaLabel: 'Còn 6 ngày',
    attachments: ['ielts-certificate.pdf'],
    steps: buildDVHCSteps(people.tranThiMai, false, EProcessingForm.ONLINE_KY_SO, 1, 'PVB-807'),
  },
  {
    id: 't10',
    code: 'SV-2085',
    title: 'Xin xác nhận sinh viên đang học',
    content: 'Em cần giấy xác nhận sinh viên đang học để nộp hồ sơ vay vốn ngân hàng.',
    student: people.ngoThanhTung,
    type: ETicketType.DICH_VU_HANH_CHINH,
    creator: people.tranThiMai,
    createdAt: '2026-06-29T09:00:00',
    source: ETicketSource.TAO_TICKET,
    documentCode: 'PVB-808',
    processingForm: EProcessingForm.OFFLINE_KY_TAY,
    hasFee: true,
    paymentStatus: EPaymentStatus.CHUA_THANH_TOAN,
    feeAmount: 20000,
    assignee: people.tranThiMai,
    supporters: [],
    notifyRecipients: [people.ngoThanhTung],
    deadline: '2026-07-06T17:00:00',
    status: ETicketStatus.MOI,
    slaPercent: 5,
    slaLabel: 'Còn 7 ngày',
    attachments: [],
    steps: buildDVHCSteps(people.tranThiMai, true, EProcessingForm.OFFLINE_KY_TAY, 2, 'PVB-808'),
  },
];

/* ─── Stats Cards ────────────────────────────────────────── */

export const buildTicketStats = (tickets: ITicket[]): ITicketStatsCard[] => [
  {
    key: 'total',
    label: 'Tổng số ticket',
    value: tickets.length,
    subLabel: '+32 tháng này',
    color: 'blue',
    icon: 'layers',
  },
  {
    key: 'assigned_to_me',
    label: 'Cần tôi xử lý',
    value: tickets.filter((t) => t.assignee.id === 's1').length,
    subLabel: 'Theo người phụ trách',
    color: 'yellow',
    icon: 'user',
  },
  {
    key: 'in_progress',
    label: 'Đang xử lý',
    value: tickets.filter((t) => t.status === ETicketStatus.DANG_XU_LY).length,
    subLabel: '5 ngày gần nhất',
    color: 'orange',
    icon: 'clock',
  },
  {
    key: 'overdue',
    label: 'Quá hạn SLA',
    value: tickets.filter((t) => t.slaLabel.includes('Quá')).length,
    subLabel: 'Cần xử lý gấp',
    color: 'red',
    icon: 'alert-triangle',
  },
  {
    key: 'completed',
    label: 'Đã hoàn tất',
    value: tickets.filter((t) => t.status === ETicketStatus.DA_HOAN_TAT).length,
    subLabel: 'Đạt SLA 95%',
    color: 'green',
    icon: 'check-circle',
  },
];

/* ─── Mock Chat Transcript for AI Chatbot Source ─────────── */

export const mockChatTranscript = [
  {
    role: 'bot' as const,
    content: 'Xin chào! Tôi là trợ lý AI của Trường ĐH Gia Định. Tôi có thể giúp gì cho bạn?',
    timestamp: '2026-06-23T08:35:00',
  },
  {
    role: 'user' as const,
    content: 'Em muốn hỏi về việc đóng học phí theo đợt có được không?',
    timestamp: '2026-06-23T08:36:00',
  },
  {
    role: 'bot' as const,
    content: 'Trường ĐH Gia Định có chính sách cho phép sinh viên đóng học phí theo đợt trong các trường hợp đặc biệt. Bạn cần liên hệ Phòng Đào tạo để được tư vấn chi tiết. Bạn muốn tôi tạo ticket để cán bộ liên hệ trực tiếp không?',
    timestamp: '2026-06-23T08:37:00',
  },
  {
    role: 'user' as const,
    content: 'Dạ vâng, em muốn tạo ticket ạ.',
    timestamp: '2026-06-23T08:38:00',
  },
  {
    role: 'bot' as const,
    content: '✅ Đã tạo ticket TC-118 "Xin đóng học phí theo đợt" và chuyển giao cho Phòng Đào tạo. Cán bộ sẽ liên hệ bạn trong thời gian sớm nhất.',
    timestamp: '2026-06-23T08:39:00',
  },
];

/* ─── Mock Faculties & Students for Create Form ──────────── */

export const mockFaculties = [
  { id: 'f1', name: 'Khoa Công nghệ thông tin' },
  { id: 'f2', name: 'Khoa Kinh tế' },
  { id: 'f3', name: 'Khoa Luật' },
  { id: 'f4', name: 'Khoa Ngoại ngữ' },
  { id: 'f5', name: 'Khoa Quản trị kinh doanh' },
];

export const mockStudentsByFaculty: Record<string, IPerson[]> = {
  f1: [people.nguyenVanAn, people.voQuocHuy],
  f2: [people.tranMinhKhoi, people.hoangAnhTu],
  f3: [people.phamThuHa],
  f4: [people.ngoThanhTung],
  f5: [],
};

/* ─── Mock Document Templates for DVHC ───────────────────── */

export const mockDocumentTemplates = [
  { id: 'dt1', name: 'Đơn xin chuyển ngành', fee: 50000, sla: '7 ngày', unit: 'Phòng Đào tạo' },
  { id: 'dt2', name: 'Đơn xin bảo lưu kết quả', fee: 30000, sla: '5 ngày', unit: 'Phòng Đào tạo' },
  { id: 'dt3', name: 'Giấy xác nhận sinh viên', fee: 20000, sla: '3 ngày', unit: 'Phòng Đào tạo' },
  { id: 'dt4', name: 'Cấp bảng điểm có dấu', fee: 50000, sla: '5 ngày', unit: 'Phòng Đào tạo' },
  { id: 'dt5', name: 'Giấy giới thiệu thực tập', fee: 0, sla: '5 ngày', unit: 'Phòng Đào tạo' },
  { id: 'dt6', name: 'Đơn phúc khảo điểm', fee: 0, sla: '7 ngày', unit: 'Khoa chuyên môn' },
];
