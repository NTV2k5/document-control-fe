import type { ITicketStepCardProps, ITicketStep } from '../ticket.type';
import { EStepStatus } from '../ticket.type';
import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import {
  AlertCircle,
  Paperclip,
  ChevronRight,
  CheckCircle,
  Clock,
  Circle,
  ShieldCheck,
  CreditCard,
  FilePlus,
  GitBranch,
  Printer,
  Send,
  UserCheck,
  Phone,
  FileText,
  ClipboardCheck,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

const stepIconMap: Record<string, React.ReactNode> = {
  'clipboard-check': <ClipboardCheck className="size-4" />,
  'shield-check': <ShieldCheck className="size-4" />,
  'credit-card': <CreditCard className="size-4" />,
  'file-plus': <FilePlus className="size-4" />,
  'git-branch': <GitBranch className="size-4" />,
  'printer': <Printer className="size-4" />,
  'send': <Send className="size-4" />,
  'user-check': <UserCheck className="size-4" />,
  'check-circle': <CheckCircle className="size-4" />,
  'phone': <Phone className="size-4" />,
  'file-text': <FileText className="size-4" />,
};

const statusConfig = {
  [EStepStatus.DA_XONG]: {
    dotBg: 'bg-emerald-500',
    dotBorder: 'border-emerald-200',
    lineBg: 'bg-emerald-300',
    badge: 'bg-emerald-50 text-emerald-600',
    badgeLabel: 'Đã xong',
    cardBorder: 'border-emerald-100',
    cardBg: 'bg-white',
  },
  [EStepStatus.DANG_CHO]: {
    dotBg: 'bg-amber-500',
    dotBorder: 'border-amber-200',
    lineBg: 'bg-slate-200',
    badge: 'bg-amber-50 text-amber-600',
    badgeLabel: 'Đang chờ',
    cardBorder: 'border-amber-200 ring-1 ring-amber-100',
    cardBg: 'bg-amber-50/30',
  },
  [EStepStatus.CHUA_TOI]: {
    dotBg: 'bg-slate-300',
    dotBorder: 'border-slate-200',
    lineBg: 'bg-slate-200',
    badge: 'bg-slate-100 text-slate-400',
    badgeLabel: 'Chưa tới',
    cardBorder: 'border-slate-100',
    cardBg: 'bg-slate-50/50 opacity-60',
  },
};

const formatDateTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

export const TicketStepCard = ({ step, isLast, viewRole = 'staff', onStepUpdate }: ITicketStepCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(step.comments);
  const [newComment, setNewComment] = useState('');

  const qrValue = step.paymentInfo?.transferContent
    ? `00020101021238580010A00000072701280006970436011412345678900208QRIBFTTA53037045405500005802VN62380815${step.paymentInfo.transferContent}6304`
    : '';

  // Simulation states
  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [localProofAttached, setLocalProofAttached] = useState(step.paymentInfo?.proofAttached || false);
  const [localProofFile, setLocalProofFile] = useState(step.paymentInfo?.proofFile || '');
  const [localScanAttached, setLocalScanAttached] = useState(!!step.uploadedFile);
  const [localScanFile, setLocalScanFile] = useState(step.uploadedFile || '');
  const [showProofLightbox, setShowProofLightbox] = useState(false);

  useEffect(() => {
    setComments(step.comments);
  }, [step.comments]);

  useEffect(() => {
    setLocalProofAttached(step.paymentInfo?.proofAttached || false);
    setLocalProofFile(step.paymentInfo?.proofFile || '');
    setLocalScanAttached(!!step.uploadedFile);
    setLocalScanFile(step.uploadedFile || '');
  }, [step]);

  const config = statusConfig[step.status];

  const handleAddComment = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    const commentItem = {
      id: Math.random().toString(36).substring(7),
      stepId: step.id,
      author: {
        id: viewRole === 'student' ? 'student' : 'staff',
        name: viewRole === 'student' ? 'Sinh viên (Bạn)' : 'Cán bộ Phòng Đào tạo',
        role: viewRole === 'student' ? 'Sinh viên' : 'Cán bộ',
      },
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const updatedComments = [...comments, commentItem];
    setComments(updatedComments);
    setNewComment('');
    if (onStepUpdate) {
      onStepUpdate(step.id, { comments: updatedComments });
    }
  };

  const handleCompleteStep = (resultSummary: string, extraFields: Partial<ITicketStep> = {}) => {
    if (onStepUpdate) {
      onStepUpdate(step.id, {
        status: EStepStatus.DA_XONG,
        completedAt: new Date().toISOString(),
        resultSummary,
        ...extraFields
      });
    }
  };

  // Helper to determine if a step is a studentAction
  const isStudentStep =
    step.isStudentAction ||
    step.icon === 'user-check' ||
    step.name.toLowerCase().includes('sinh viên xác nhận') ||
    step.name.toLowerCase().includes('thanh toán qr');

  return (
    <div className="relative flex gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${config.dotBorder} ${config.dotBg} text-white`}>
          {step.status === EStepStatus.DA_XONG ? (
            <CheckCircle className="size-4" />
          ) : step.status === EStepStatus.DANG_CHO ? (
            <Clock className="size-4" />
          ) : (
            <Circle className="size-4" />
          )}
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 ${config.lineBg}`} />
        )}
      </div>

      {/* Card content */}
      <div className={`mb-4 flex-1 rounded-xl border p-4 ${config.cardBorder} ${config.cardBg} transition-all`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-slate-700">{stepIconMap[step.icon] || <Circle className="size-4" />}</div>
              <h4 className="text-sm font-semibold text-slate-800">{step.name}</h4>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              <span className="italic">by</span> {step.performer}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${config.badge}`}>
            {config.badgeLabel}
          </span>
        </div>

        {/* Completed timestamp */}
        {step.completedAt && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600">
            <CheckCircle className="size-3" />
            <span>Hoàn thành lúc {formatDateTime(step.completedAt)}</span>
          </div>
        )}

        {/* Description */}
        {step.description && step.status !== EStepStatus.DA_XONG && (
          <p className="mt-2 text-xs text-slate-500">{step.description}</p>
        )}

        {/* Result summary (when done) */}
        {step.resultSummary && step.status === EStepStatus.DA_XONG && (
          <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <CheckCircle className="mr-1 inline size-3" />
            {step.resultSummary}
          </div>
        )}

        {/* Approval levels detail */}
        {step.approvalLevels && step.approvalLevels.length > 0 && (
          <div className="mt-3 space-y-2">
            {step.approvalLevels.map((level) => (
              <div
                key={level.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${
                    level.status === 'approved' ? 'bg-emerald-500' : level.status === 'pending' ? 'bg-amber-500' : 'bg-slate-300'
                  }`} />
                  <span className="text-xs font-medium text-slate-700">{level.label}</span>
                </div>
                {level.status === 'approved' ? (
                  <span className="text-[10px] text-emerald-600">Đã duyệt</span>
                ) : level.status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                      Đang chờ duyệt
                    </span>
                    {viewRole === 'staff' && (
                      <button
                        onClick={() => {
                          const updatedLevels = step.approvalLevels?.map(l => l.id === level.id ? { ...l, status: 'approved' as const } : l);
                          handleCompleteStep('Đơn từ đã được phê duyệt đầy đủ qua các cấp.', { approvalLevels: updatedLevels });
                          alert('Phê duyệt thành công!');
                        }}
                        className="rounded bg-blue-600 px-3 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-blue-700"
                      >
                        Duyệt
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400">Chờ</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Uploaded PDF file scan display */}
        {localScanAttached && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-100 bg-white p-2.5 text-xs text-blue-600">
            <FileText className="size-3.5" />
            <span className="truncate">Bản scan đã đính kèm: {localScanFile}</span>
            <a href="#" onClick={(e) => { e.preventDefault(); alert('Đang tải xuống file scan sao chép...'); }} className="ml-auto underline text-[10px] text-slate-500 hover:text-slate-700">Tải xuống</a>
          </div>
        )}

        {/* Payment info (when done) */}
        {step.paymentInfo && step.status === EStepStatus.DA_XONG && (
          <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Đã thu {step.paymentInfo.amount.toLocaleString('vi-VN')}đ qua QR ngân hàng.
          </div>
        )}

        {/* Call note */}
        {step.callNote && (
          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <strong>Ghi chú cuộc gọi:</strong> {step.callNote}
          </div>
        )}

        {/* Feedback note */}
        {step.feedbackNote && (
          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <strong>Kết quả phản hồi:</strong> {step.feedbackNote}
          </div>
        )}

        {/* CTA buttons for current step */}
        {step.status === EStepStatus.DANG_CHO && (
          <div className="mt-3">
            {/* If viewRole is student and this is NOT a student step, lock it */}
            {viewRole === 'student' && !isStudentStep ? (
              <div className="rounded-lg bg-slate-50 border border-slate-150 p-2.5 text-xs text-slate-500 flex items-start gap-2">
                <AlertCircle className="size-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Bước này do hệ thống/cán bộ phụ trách thực hiện. Bạn sẽ được thông báo khi có cập nhật.
                </span>
              </div>
            ) : (
              <>
                {/* 1. Phone step */}
                {step.icon === 'phone' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => alert('Đang kết nối cuộc gọi GDU360...')}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                      >
                        Gọi qua GDU360
                      </button>
                      <button 
                        onClick={() => alert('Đang thực hiện cuộc gọi di động...')}
                        className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-slate-50"
                      >
                        Gọi số di động
                      </button>
                      <button 
                        onClick={() => setShowNoteInput(!showNoteInput)}
                        className="rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                      >
                        Đã gọi & ghi nhận kết quả
                      </button>
                    </div>
                    {showNoteInput && (
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                        <textarea
                          placeholder="Nhập nội dung cuộc gọi..."
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="w-full min-h-[60px] rounded-md border border-slate-200 p-2 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
                        />
                        <button
                          onClick={() => handleCompleteStep('Đã gọi điện và ghi nhận kết quả.', { callNote: noteText || 'Đã liên hệ thành công.' })}
                          className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                        >
                          Lưu kết quả gọi điện
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Feedback text step */}
                {step.icon === 'file-text' && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                      <textarea
                        placeholder="Nhập nội dung phản hồi của sinh viên..."
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="w-full min-h-[60px] rounded-md border border-slate-200 p-2 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
                      />
                      <button
                        onClick={() => handleCompleteStep('Đã lưu kết quả phản hồi thành công.', { feedbackNote: noteText || 'Sinh viên đã nhận phản hồi.' })}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Lưu kết quả phản hồi
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Close ticket step */}
                {step.icon === 'check-circle' && (
                  <button
                    onClick={() => handleCompleteStep('Ticket đã được đóng thành công.')}
                    className="rounded-md bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
                  >
                    Đóng ticket
                  </button>
                )}

                {/* 4. Create document/phieu step */}
                {step.icon === 'file-plus' && (
                  <button
                    onClick={() => handleCompleteStep('Đã tạo Đơn từ từ Phiếu PVB-002.')}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Tạo phiếu
                  </button>
                )}

                {/* 5. Send file / notice step */}
                {step.icon === 'send' && (
                  <div className="space-y-2">
                    {step.name.includes('scan') ? (
                      <div className="space-y-2">
                        {localScanAttached ? (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Paperclip className="size-3.5 text-emerald-600" />
                            <span className="truncate">Đã đính kèm: {localScanFile}</span>
                            <button 
                              onClick={() => { setLocalScanAttached(false); setLocalScanFile(''); }}
                              className="text-red-500 underline text-[10px]"
                            >
                              Xóa
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setLocalScanAttached(true); setLocalScanFile('document_scan_copy.pdf'); }}
                            className="flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            <Paperclip className="size-3.5" />
                            Đính kèm file scan (.pdf)
                          </button>
                        )}
                        <button
                          disabled={!localScanAttached}
                          onClick={() => handleCompleteStep('Đã gửi email bản scan cho sinh viên.', { uploadedFile: localScanFile })}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors ${
                            localScanAttached ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' : 'bg-slate-300 cursor-not-allowed'
                          }`}
                        >
                          Gửi email cho sinh viên
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCompleteStep('Đã gửi email thông báo thành công.')}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Gửi email / thông báo
                      </button>
                    )}
                  </div>
                )}

                {/* 6. Payment QR step */}
                {step.icon === 'credit-card' && (
                  <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Thông tin thanh toán QR
                    </span>
                    
                    {/* Bank Info */}
                    <div className="text-xs space-y-1 bg-white p-2.5 rounded border border-slate-100 text-slate-600">
                      <div>Ngân hàng: <span className="font-semibold text-slate-800">{step.paymentInfo?.bank || 'Vietcombank'}</span></div>
                      <div>Số tài khoản: <span className="font-semibold text-slate-800">{step.paymentInfo?.accountNumber || '1234567890'}</span></div>
                      <div>Chủ tài khoản: <span className="font-semibold text-slate-800">{step.paymentInfo?.accountHolder || 'Trường ĐH Gia Định'}</span></div>
                      <div>Số tiền: <span className="font-semibold text-slate-800">{(step.paymentInfo?.amount || 50000).toLocaleString('vi-VN')}đ</span></div>
                      <div>Nội dung: <span className="font-semibold text-blue-600">{step.paymentInfo?.transferContent || 'SV-2041 2174801000'}</span></div>
                    </div>

                    {/* QR Graphic preview with click trigger */}
                    <div className="flex justify-center my-2">
                      <div 
                        onClick={() => setShowProofLightbox(true)}
                        className="cursor-pointer border border-slate-200 bg-white p-1 rounded-lg shadow-sm hover:shadow"
                      >
                        <div className="size-24 flex items-center justify-center bg-white p-1 rounded">
                          <QRCode
                            size={80}
                            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                            value={qrValue}
                            viewBox={`0 0 256 256`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Check role */}
                    {viewRole === 'student' ? (
                      <div className="space-y-2">
                        {localProofAttached ? (
                          <div className="flex items-center gap-2 text-xs text-slate-600 bg-emerald-50 border border-emerald-100 p-2 rounded">
                            <Paperclip className="size-3.5 text-emerald-600" />
                            <span className="truncate">Minh chứng: {localProofFile}</span>
                            <button 
                              onClick={() => { setLocalProofAttached(false); setLocalProofFile(''); }}
                              className="text-red-500 underline text-[10px] ml-auto shrink-0"
                            >
                              Xóa
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setLocalProofAttached(true); setLocalProofFile('proof_payment.png'); }}
                            className="flex items-center justify-center gap-1.5 w-full rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
                          >
                            <Paperclip className="size-3.5" />
                            Đính kèm ảnh/biên lai minh chứng
                          </button>
                        )}
                        <button
                          disabled={!localProofAttached}
                          onClick={() => {
                            if (onStepUpdate) {
                              onStepUpdate(step.id, {
                                paymentInfo: {
                                  ...step.paymentInfo!,
                                  proofAttached: true,
                                  proofFile: localProofFile
                                }
                              });
                            }
                            alert('Đã gửi thông tin minh chứng chuyển khoản! Vui lòng chờ cán bộ duyệt.');
                          }}
                          className={`w-full rounded-md px-3 py-2 text-xs font-bold text-white transition-all ${
                            localProofAttached ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-slate-300 cursor-not-allowed'
                          }`}
                        >
                          Hoàn tất chuyển khoản
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {step.paymentInfo?.proofAttached ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-emerald-50/50 p-2 rounded border border-emerald-100">
                              <Paperclip className="size-3.5 text-emerald-600" />
                              <span className="truncate font-semibold text-slate-800">Minh chứng: {step.paymentInfo.proofFile}</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => alert('Đang đối soát tài khoản thanh toán... Giao dịch hợp lệ.')}
                                className="flex-1 rounded border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
                              >
                                Kiểm tra giao dịch
                              </button>
                              <button
                                onClick={() => handleCompleteStep('Đã thu 50.000đ qua QR ngân hàng - giao dịch thành công.', {
                                  paymentInfo: {
                                    ...step.paymentInfo!,
                                    proofAttached: true,
                                    proofFile: step.paymentInfo?.proofFile
                                  }
                                })}
                                className="flex-1 rounded bg-emerald-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-800"
                              >
                                Xác nhận thanh toán
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded bg-amber-50 text-amber-700 p-2 text-center text-xs">
                            Đang chờ sinh viên chuyển khoản và đính kèm minh chứng.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 7. Student confirmation step */}
                {step.icon === 'user-check' && (
                  <div>
                    {viewRole === 'student' ? (
                      <button
                        onClick={() => handleCompleteStep('Sinh viên đã xác nhận đã nhận file/hồ sơ.')}
                        className="rounded bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                      >
                        Xác nhận đã nhận file/hồ sơ
                      </button>
                    ) : (
                      <div className="rounded bg-amber-50 text-amber-700 p-2 text-center text-xs">
                        Đang chờ sinh viên xác nhận.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Comments toggle */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="mt-3 flex items-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-blue-500"
        >
          <MessageSquare className="size-3" />
          <span>Trao đổi về bước này</span>
          {showComments ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>

        {showComments && (
          <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
            {comments.length === 0 && (
              <p className="text-[11px] text-slate-400 italic mb-2">Chưa có bình luận.</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700">{c.author.name}</span>
                  <span className="text-[10px] text-slate-400">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-normal">{c.content}</p>
              </div>
            ))}
            
            {/* Input field to add a new comment */}
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                placeholder="Nhập nội dung bình luận..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddComment();
                  }
                }}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddComment}
                className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 shrink-0"
              >
                <Send className="size-3" />
              </button>
            </div>
          </div>
        )}

        {/* Lightbox for Payment proof QR code inside step */}
        {showProofLightbox && (
          <div 
            onClick={() => setShowProofLightbox(false)}
            className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 p-4 cursor-zoom-out"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="relative flex flex-col items-center rounded-2xl bg-white p-6 max-w-sm w-full cursor-default"
            >
              <button 
                onClick={() => setShowProofLightbox(false)}
                className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X className="size-4" />
              </button>
              <h3 className="mb-4 text-base font-bold text-slate-800">Quét Mã QR</h3>
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-center shadow-inner">
                <QRCode
                  size={180}
                  style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  value={qrValue}
                  viewBox={`0 0 256 256`}
                />
              </div>
              <p className="mt-4 text-xs font-semibold text-slate-700 text-center">
                Vietcombank · 1234567890 · Trường ĐH Gia Định
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
