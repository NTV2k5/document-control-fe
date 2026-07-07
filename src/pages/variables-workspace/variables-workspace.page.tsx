import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from 'reactjs-platform/ui';
import { VariablesDrawer } from '../../components';
import { clearVariablesWorkspaceSession, getVariablesWorkspaceSession } from '../../stores';

interface IVariablesWorkspacePageProps {
  fallbackBackTo: string;
}

export const VariablesWorkspacePage = ({ fallbackBackTo }: IVariablesWorkspacePageProps) => {
  const navigate = useNavigate();
  const session = getVariablesWorkspaceSession();
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);

  useEffect(() => {
    if (session) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      navigate({ to: fallbackBackTo });
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fallbackBackTo, navigate, session]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Phát hiện tải lại trang</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Không gian biến chỉ lưu trạng thái tạm thời trong bộ nhớ. Sau khi tải lại, trạng thái này không còn nên hệ
            thống sẽ đưa bạn quay lại trình soạn thảo.
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: fallbackBackTo })}>
            Quay lại trình soạn thảo
          </Button>
        </div>
      </div>
    );
  }

  const handleClose = () => {
    const backTo = session.backTo;
    clearVariablesWorkspaceSession();
    navigate({ to: backTo });
  };

  const pageTitle = session.backTo.startsWith('/documents')
    ? 'Biến tài liệu'
    : session.backTo === '/templates/new'
      ? 'Biến mẫu mới'
      : 'Biến mẫu tài liệu';
  const pageHeading = session.resourceLabel ? `${session.resourceLabel}` : pageTitle;

  const handleSaveVariables = async (overrideVarValues: Record<string, string>) => {
    await session.onSaveVariables(overrideVarValues);
    handleClose();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden bg-slate-100">
      <div
        className={`shrink-0 border-b border-slate-200 bg-white px-6 transition-[padding] duration-200 ${isHeaderCollapsed ? 'py-2.5' : 'py-4'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="size-9 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="Quay lại"
                aria-label="Quay lại">
                <ArrowLeft className="size-4" />
              </Button>
              <div className="min-w-0">
                <div className="truncate text-xl font-bold text-[#002147]">{pageHeading}</div>
                <div
                  className={`overflow-hidden text-sm text-slate-500 transition-all duration-200 ${
                    isHeaderCollapsed ? 'max-h-0 opacity-0' : 'mt-1 max-h-20 opacity-100'
                  }`}>
                  Quản lý biến, mẫu bảng và mẫu nội dung cho trình soạn thảo này.
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsHeaderCollapsed((value) => !value)}
              title={isHeaderCollapsed ? 'Mở rộng tiêu đề' : 'Thu gọn tiêu đề'}
              aria-label={isHeaderCollapsed ? 'Mở rộng tiêu đề' : 'Thu gọn tiêu đề'}
              className="size-9 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${isHeaderCollapsed ? '' : 'rotate-180'}`}
              />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden px-6 py-6">
        <div className="flex min-h-0 w-full flex-1 flex-col rounded-[28px] border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <VariablesDrawer
            {...session}
            open
            onClose={handleClose}
            onSaveVariables={handleSaveVariables}
            renderMode="page"
          />
        </div>
      </div>
    </div>
  );
};
