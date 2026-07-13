import type { ICreateTicketModalProps } from '../ticket.type';
import { ETicketType } from '../ticket.type';
import { useState } from 'react';
import { X, Info, FileText, CheckCircle, ClipboardCheck, ArrowRight } from 'lucide-react';
import { mockFaculties, mockStudentsByFaculty, mockDocumentTemplates } from '../ticket.mock';

export const CreateTicketModal = ({ open, onClose }: ICreateTicketModalProps) => {
  const [ticketType, setTicketType] = useState<ETicketType>(ETicketType.CUNG_CAP_THONG_TIN);
  const [faculty, setFaculty] = useState('');
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [responseMethod, setResponseMethod] = useState('gdu360');
  const [slaOption, setSlaOption] = useState('same_day');
  const [documentTemplateId, setDocumentTemplateId] = useState('');
  const [deliveryForm, setDeliveryForm] = useState('ONLINE_KY_SO');

  if (!open) return null;

  const students = faculty ? (mockStudentsByFaculty[faculty] || []) : [];
  const selectedStudent = students.find((s) => s.id === studentId);
  const selectedTemplate = mockDocumentTemplates.find((t) => t.id === documentTemplateId);

  const handleReset = () => {
    setFaculty('');
    setStudentId('');
    setTitle('');
    setContent('');
    setResponseMethod('gdu360');
    setSlaOption('same_day');
    setDocumentTemplateId('');
    setDeliveryForm('ONLINE_KY_SO');
  };

  const handleSubmit = () => {
    // Demo only — no real submission
    onClose();
    handleReset();
  };

  const isCCTT = ticketType === ETicketType.CUNG_CAP_THONG_TIN;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="mt-0 sm:mt-8 flex h-full sm:h-[calc(100vh-64px)] w-full max-w-5xl flex-col overflow-hidden sm:rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Tạo mới ticket</h2>
            <p className="text-xs text-slate-400">Điền đầy đủ thông tin để khởi tạo ticket.</p>
          </div>
          <button
            onClick={() => { onClose(); handleReset(); }}
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body (2 columns) */}
        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
          {/* Left Column — Ticket Info */}
          <div className="w-full md:w-1/2 md:overflow-y-auto border-b md:border-b-0 md:border-r border-slate-100 p-6">
            {/* Loại ticket */}
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <FileText className="size-3.5" />
                Loại ticket
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTicketType(ETicketType.CUNG_CAP_THONG_TIN)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    isCCTT
                      ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`flex size-8 items-center justify-center rounded-lg ${
                    isCCTT ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Info className="size-4" />
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">Cung cấp thông tin</div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    Giải đáp / hỗ trợ trực tiếp qua gọi điện hoặc tin nhắn.
                  </div>
                </button>
                <button
                  onClick={() => setTicketType(ETicketType.DICH_VU_HANH_CHINH)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    !isCCTT
                      ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`flex size-8 items-center justify-center rounded-lg ${
                    !isCCTT ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <FileText className="size-4" />
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">Dịch vụ hành chính</div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    Xử lý Phiếu thông tin văn bản, có luồng phê duyệt.
                  </div>
                </button>
              </div>
            </div>

            {/* Thông tin sinh viên */}
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <ClipboardCheck className="size-3.5" />
                Thông tin sinh viên
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Khoa / Đơn vị của sinh viên
                  </label>
                  <select
                    value={faculty}
                    onChange={(e) => { setFaculty(e.target.value); setStudentId(''); }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">— Chọn Khoa —</option>
                    {mockFaculties.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Sinh viên
                  </label>
                  <select
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    disabled={!faculty}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">— Chọn Khoa trước —</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.mssv})</option>
                    ))}
                  </select>
                </div>
                {selectedStudent?.mssv && (
                  <p className="text-xs text-slate-500">
                    MSSV sẽ tự động hiển thị sau khi chọn sinh viên: <strong>{selectedStudent.mssv}</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Tiêu đề & nội dung */}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Tiêu đề ticket
                </label>
                <input
                  type="text"
                  placeholder="VD: Đơn xin xác nhận sinh viên"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Nội dung yêu cầu
                </label>
                <textarea
                  placeholder="Mô tả yêu cầu của sinh viên..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          {/* Right Column — Configuration */}
          <div className="w-full md:w-1/2 md:overflow-y-auto bg-slate-50/40 p-6">
            {/* Type description */}
            <div className={`mb-5 rounded-xl border p-4 ${
              isCCTT ? 'border-blue-200 bg-blue-50' : 'border-indigo-200 bg-indigo-50'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`flex size-8 items-center justify-center rounded-lg ${
                  isCCTT ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
                }`}>
                  {isCCTT ? <Info className="size-4" /> : <FileText className="size-4" />}
                </div>
                <div>
                  <div className={`text-sm font-bold ${isCCTT ? 'text-blue-800' : 'text-indigo-800'}`}>
                    {isCCTT ? 'Cung cấp thông tin' : 'Dịch vụ hành chính'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isCCTT
                      ? 'Cán bộ liên hệ trực tiếp sinh viên, cập nhật kết quả rồi đóng ticket.'
                      : 'Xử lý Phiếu thông tin văn bản, có luồng phê duyệt nhiều cấp.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Config fields based on type */}
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Cấu hình xử lý
            </h3>

            {isCCTT ? (
              /* CCTT Config */
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Đơn vị phụ trách xử lý</div>
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                      <FileText className="size-3.5" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">Phòng Đào tạo</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Hình thức phản hồi</label>
                  <select
                    value={responseMethod}
                    onChange={(e) => setResponseMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="gdu360">Gọi qua GDU360</option>
                    <option value="mobile">Gọi di động</option>
                    <option value="message">Nhắn tin</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">SLA mong muốn phản hồi</label>
                  <select
                    value={slaOption}
                    onChange={(e) => setSlaOption(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="same_day">Trong ngày</option>
                    <option value="1_day">1 ngày</option>
                    <option value="3_days">3 ngày</option>
                    <option value="1_week">1 tuần</option>
                  </select>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
                      <CheckCircle className="size-3.5" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-700">Miễn phí</span>
                  </div>
                  <p className="mt-1 text-[10px] text-emerald-600">
                    Loại ticket này không thu phí, xử lý ngay sau khi tiếp nhận.
                  </p>
                </div>

                {/* Preview steps */}
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Các bước xử lý (xem trước)
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">Tiếp nhận & phân công</span>
                    <ArrowRight className="size-3 text-slate-300" />
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">Gọi sinh viên</span>
                    <ArrowRight className="size-3 text-slate-300" />
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">Cập nhật kết quả</span>
                    <ArrowRight className="size-3 text-slate-300" />
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">Đóng ticket</span>
                  </div>
                </div>
              </div>
            ) : (
              /* DVHC Config */
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Chọn Phiếu thông tin văn bản
                  </label>
                  <select
                    value={documentTemplateId}
                    onChange={(e) => setDocumentTemplateId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">— Chọn Phiếu —</option>
                    {mockDocumentTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {selectedTemplate && (
                  <div className={`rounded-xl border p-3 ${
                    selectedTemplate.fee > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      {selectedTemplate.fee > 0 ? (
                        <>
                          <span className="text-sm font-semibold text-amber-700">
                            {selectedTemplate.fee.toLocaleString('vi-VN')}đ
                          </span>
                          <span className="text-[10px] text-amber-600">· Có thu phí</span>
                        </>
                      ) : (
                        <>
                          <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
                            <CheckCircle className="size-3.5" />
                          </div>
                          <span className="text-sm font-semibold text-emerald-700">Miễn phí</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Hình thức cấp phát
                  </label>
                  <select
                    value={deliveryForm}
                    onChange={(e) => setDeliveryForm(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="ONLINE_KY_SO">Online ký số</option>
                    <option value="ONLINE_BAN_SCAN">Online scan ký tay</option>
                    <option value="OFFLINE_KY_TAY">Offline ký tay</option>
                  </select>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Đơn vị phụ trách</div>
                  <span className="text-sm font-medium text-slate-700">
                    {selectedTemplate?.unit || 'Tự điền theo Phiếu'}
                  </span>
                </div>

                {selectedTemplate && (
                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">SLA dự kiến</div>
                    <span className="text-sm font-medium text-slate-700">{selectedTemplate.sla}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 px-6 py-3">
          <button
            onClick={() => { onClose(); handleReset(); }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-800 hover:shadow-md active:scale-[0.98]"
          >
            Tạo ticket
          </button>
        </div>
      </div>
    </div>
  );
};
