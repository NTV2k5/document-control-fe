import { FileText, MoreHorizontal } from 'lucide-react';
import type { IHubRecentActivityProps, IHubActivityItem } from './hub-recent-activity.type';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Button,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from 'reactjs-platform/ui';
import { useTranslation } from '../../../i18n';

export const HubRecentActivity = ({ activities, onActionClick }: IHubRecentActivityProps) => {
  const { locale } = useTranslation();
  const defaultActivities: IHubActivityItem[] = [
    {
      id: '1',
      name: 'Thesis_Proposal_Final.pdf',
      fileType: 'pdf',
      lastModified: locale === 'vi' ? '2 giờ trước' : '2 hours ago',
      directory: 'Computer Science',
      owners: [
        {
          name: 'Sarah Jenkins',
          avatarUrl: 'https://i.pravatar.cc/150?img=32',
        },
        {
          name: 'Alex Rivera',
          avatarUrl: 'https://i.pravatar.cc/150?img=12',
        },
      ],
    },
    {
      id: '2',
      name: 'Lab_Notes_Week_12.docx',
      fileType: 'docx',
      lastModified: locale === 'vi' ? 'Hôm qua, 14:30' : 'Yesterday, 14:30',
      directory: 'AI Research Lab',
      owners: [
        {
          name: 'Albert Tang',
          initials: 'AT',
        },
      ],
    },
  ];

  const displayActivities = activities ?? defaultActivities;

  const renderFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return (
          <div className="flex size-8 items-center justify-center rounded-lg bg-red-50 text-red-500">
            <FileText className="size-4" />
          </div>
        );
      case 'docx':
        return (
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <FileText className="size-4" />
          </div>
        );
      case 'xlsx':
        return (
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <FileText className="size-4" />
          </div>
        );
      default:
        return (
          <div className="flex size-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
            <FileText className="size-4" />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[17px] font-bold text-slate-800">{locale === 'vi' ? 'Hoạt động gần đây' : 'Recent Activity'}</h3>
        <button
          type="button"
          className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
        >
          {locale === 'vi' ? 'Xem nhật ký kiểm tra đầy đủ' : 'View Full Audit Trail'}
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] table-auto text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                <th className="px-6 py-4">{locale === 'vi' ? 'Tên' : 'Name'}</th>
                <th className="px-6 py-4">{locale === 'vi' ? 'Cập nhật cuối' : 'Last Modified'}</th>
                <th className="px-6 py-4">{locale === 'vi' ? 'Thư mục' : 'Directory'}</th>
                <th className="px-6 py-4">{locale === 'vi' ? 'Người sở hữu' : 'Owners'}</th>
                <th className="w-16 px-6 py-4 text-center" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayActivities.map((activity) => (
                <tr
                  key={activity.id}
                  className="group transition-colors hover:bg-slate-50/40"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {renderFileIcon(activity.fileType)}
                      <span
                        onClick={() => onActionClick?.('view', activity)}
                        className="font-semibold text-slate-700 hover:text-blue-600 cursor-pointer transition-colors"
                      >
                        {activity.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{activity.lastModified}</td>
                  <td className="px-6 py-4 font-medium text-slate-600">{activity.directory}</td>
                  <td className="px-6 py-4">
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {activity.owners.map((owner, idx) => (
                        <Avatar
                          key={owner.name}
                          className="size-7 border-2 border-white shadow-sm"
                          style={{ zIndex: 10 - idx }}
                        >
                          {owner.avatarUrl ? (
                            <AvatarImage src={owner.avatarUrl} alt={owner.name} />
                          ) : null}
                          <AvatarFallback className="bg-orange-100 text-[10px] font-bold text-orange-600">
                            {owner.initials ?? owner.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => onActionClick?.('view', activity)}
                        >
                          {locale === 'vi' ? 'Xem chi tiết' : 'View Details'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onActionClick?.('download', activity)}
                        >
                          {locale === 'vi' ? 'Tải xuống' : 'Download'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onActionClick?.('delete', activity)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          {locale === 'vi' ? 'Xóa' : 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
