import { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Bell,
  Grid,
  Bot,
  Database,
  CheckCircle,
  Clock,
  Laptop,
  Sun,
  Moon,
  Info,
  ChevronRight,
  HardDrive,
  FileText,
} from 'lucide-react';
import type { ISettingsSectionProps } from './settings.type';
import { OpenAiSettingsSection } from '../openai-settings';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  RadioGroup,
  RadioGroupItem,
  Label,
  Switch,
} from 'reactjs-platform/ui';
import { toast } from 'react-toastify';
import { useTranslation } from '../../i18n';
import { getMyStatsAPI } from 'api';
import { formatBytes } from '../../api/my-hubs/my-hubs.api';

type TSettingsTab = 'general' | 'privacy' | 'notifications' | 'apps' | 'ai';

interface IStorageFileMock {
  name: string;
  size: number;
  type: string;
}

const STORAGE_MOCK_FILES: IStorageFileMock[] = [
  { name: 'Moodle system overview presentation.pdf', size: 12450000, type: 'pdf' },
  { name: 'Ban giao Doc Control.pdf', size: 8932000, type: 'pdf' },
  { name: 'Document Management (Checklist).docx', size: 1845000, type: 'docx' },
  { name: 'Q3 Budget Estimate (v1).xlsx', size: 1040000, type: 'xlsx' },
  { name: 'ZALO_MINI_APP.docx', size: 452000, type: 'docx' },
  { name: 'task_management.xlsx', size: 32000, type: 'xlsx' },
];

export const SettingsSection = (_props: ISettingsSectionProps) => {
  const { locale } = useTranslation();
  const [activeTab, setActiveTab] = useState<TSettingsTab>('general');
  const [storageUsed, setStorageUsed] = useState(4.20);
  const [showStorageDetails, setShowStorageDetails] = useState(false);

  // General settings state (persisted in localStorage or state)
  const [startPage, setStartPage] = useState<string>(() => localStorage.getItem('settings_start_page') || 'home');
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('settings_theme') || 'light');
  const [density, setDensity] = useState<string>(() => localStorage.getItem('settings_density') || 'medium');

  // Notifications state
  const [notifyApprovals, setNotifyApprovals] = useState(true);
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyUpdates, setNotifyUpdates] = useState(false);

  // Privacy state
  const [shareDataAnalytics, setShareDataAnalytics] = useState(true);
  const [enableAuditLogs, setEnableAuditLogs] = useState(true);

  // Fetch real storage if available
  useEffect(() => {
    getMyStatsAPI()
      .then((stats) => {
        if (!stats) return;
        const totalBytes =
          (stats.Images?.size ?? 0) +
          (stats.Videos?.size ?? 0) +
          (stats.Documents?.size ?? 0) +
          (stats.Other?.size ?? 0);
        const bytesToTb = totalBytes / (1024 * 1024 * 1024 * 1024);
        setStorageUsed(4.20 + bytesToTb);
      })
      .catch((err) => console.error('Failed to fetch settings storage stats:', err));
  }, []);

  const handleStartPageChange = (val: string) => {
    setStartPage(val);
    localStorage.setItem('settings_start_page', val);
    toast.success(
      locale === 'vi' 
        ? `Đã đổi trang bắt đầu thành: ${val === 'home' ? 'Trang chủ' : 'Drive của tôi'}`
        : `Start page changed to: ${val === 'home' ? 'Home' : 'My Drive'}`
    );
  };

  const handleThemeChange = (val: string) => {
    setTheme(val);
    localStorage.setItem('settings_theme', val);
    
    // Simple dark mode class toggler demo
    if (val === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    toast.success(
      locale === 'vi'
        ? `Giao diện đã đổi: ${val === 'light' ? 'Sáng' : val === 'dark' ? 'Đậm' : 'Hệ thống'}`
        : `Theme changed to: ${val}`
    );
  };

  const handleDensityChange = (val: string) => {
    setDensity(val);
    localStorage.setItem('settings_density', val);
    toast.success(
      locale === 'vi'
        ? `Mật độ hiển thị đã đổi: ${val === 'low' ? 'Thấp (Thu gọn)' : 'Trung bình (Mặc định)'}`
        : `Display density changed to: ${val}`
    );
  };

  const renderFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return <FileText className="size-4 text-red-500" />;
      case 'docx':
        return <FileText className="size-4 text-blue-500" />;
      case 'xlsx':
        return <FileText className="size-4 text-emerald-500" />;
      default:
        return <FileText className="size-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <h2 className="text-3xl font-bold text-slate-900 leading-tight">
        {locale === 'vi' ? 'Cài đặt' : 'Settings'}
      </h2>

      {/* Split Layout Container */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left Settings Tabs Menu */}
        <div className="w-full shrink-0 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm lg:w-64">
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {/* General Tab */}
            <button
              onClick={() => setActiveTab('general')}
              className={`flex flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold transition duration-200 select-none ${
                activeTab === 'general'
                  ? 'bg-blue-50 text-blue-600 shadow-[0_4px_12px_rgba(37,99,235,0.05)]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Settings className="size-4 shrink-0" />
              <span className="whitespace-nowrap">{locale === 'vi' ? 'Cài đặt chung' : 'General'}</span>
            </button>

            {/* AI Assistant Tab */}
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold transition duration-200 select-none ${
                activeTab === 'ai'
                  ? 'bg-blue-50 text-blue-600 shadow-[0_4px_12px_rgba(37,99,235,0.05)]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Bot className="size-4 shrink-0" />
              <span className="whitespace-nowrap">{locale === 'vi' ? 'Cấu hình AI' : 'AI Assistant'}</span>
            </button>

            {/* Privacy Tab */}
            <button
              onClick={() => setActiveTab('privacy')}
              className={`flex flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold transition duration-200 select-none ${
                activeTab === 'privacy'
                  ? 'bg-blue-50 text-blue-600 shadow-[0_4px_12px_rgba(37,99,235,0.05)]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Shield className="size-4 shrink-0" />
              <span className="whitespace-nowrap">{locale === 'vi' ? 'Quyền riêng tư' : 'Privacy'}</span>
            </button>

            {/* Notifications Tab */}
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold transition duration-200 select-none ${
                activeTab === 'notifications'
                  ? 'bg-blue-50 text-blue-600 shadow-[0_4px_12px_rgba(37,99,235,0.05)]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Bell className="size-4 shrink-0" />
              <span className="whitespace-nowrap">{locale === 'vi' ? 'Thông báo' : 'Notifications'}</span>
            </button>

            {/* Apps Tab */}
            <button
              onClick={() => setActiveTab('apps')}
              className={`flex flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold transition duration-200 select-none ${
                activeTab === 'apps'
                  ? 'bg-blue-50 text-blue-600 shadow-[0_4px_12px_rgba(37,99,235,0.05)]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Grid className="size-4 shrink-0" />
              <span className="whitespace-nowrap">{locale === 'vi' ? 'Quản lý ứng dụng' : 'Manage Apps'}</span>
            </button>
          </nav>
        </div>

        {/* Right Content Panel */}
        <div className="flex-1 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm min-w-0">
          {/* TAB: GENERAL SETTINGS */}
          {activeTab === 'general' && (
            <div className="space-y-8 divide-y divide-slate-100">
              {/* Storage Section */}
              <div className="space-y-4 pb-6 first:pt-0">
                <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                  <Database className="size-4.5 text-blue-600" />
                  {locale === 'vi' ? 'Bộ nhớ' : 'Storage'}
                </h3>
                <div className="max-w-xl space-y-3">
                  <span className="text-xs text-slate-500 font-semibold leading-tight">
                    {locale === 'vi' 
                      ? `Đã sử dụng ${storageUsed.toFixed(2)} TB trong tổng số 10 TB`
                      : `Used ${storageUsed.toFixed(2)} TB of 10 TB`}
                  </span>
                  
                  {/* Progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-blue-600 transition-all rounded-full shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                      style={{ width: `${Math.round((storageUsed / 10) * 100)}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1.5">
                    <Button
                      onClick={() => toast.info(locale === 'vi' ? 'Khu vực thanh toán nâng cấp bộ nhớ chưa sẵn sàng!' : 'Upgrade plan coming soon!')}
                      className="h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 shadow-sm"
                    >
                      {locale === 'vi' ? 'Mua thêm bộ nhớ' : 'Buy storage'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowStorageDetails(true)}
                      className="h-9 rounded-full border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-5"
                    >
                      {locale === 'vi' ? 'Xem các mục chiếm bộ nhớ' : 'View items taking up storage'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Start Page Section */}
              <div className="space-y-4 py-6">
                <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="size-4.5 text-blue-600" />
                  {locale === 'vi' ? 'Trang bắt đầu' : 'Start page'}
                </h3>
                <div className="max-w-xl">
                  <RadioGroup value={startPage} onValueChange={handleStartPageChange} className="flex flex-col gap-3">
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem value="home" id="sp-home" />
                      <Label htmlFor="sp-home" className="text-xs font-semibold text-slate-700 cursor-pointer">
                        {locale === 'vi' ? 'Trang chủ (Tổng quan)' : 'Home (Overview)'}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem value="drive" id="sp-drive" />
                      <Label htmlFor="sp-drive" className="text-xs font-semibold text-slate-700 cursor-pointer">
                        {locale === 'vi' ? 'Drive của tôi (University Hubs)' : 'My Drive (University Hubs)'}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Theme/Giao diện Section */}
              <div className="space-y-4 py-6">
                <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                  <Laptop className="size-4.5 text-blue-600" />
                  {locale === 'vi' ? 'Giao diện' : 'Theme'}
                </h3>
                <div className="max-w-xl">
                  <RadioGroup value={theme} onValueChange={handleThemeChange} className="flex flex-col gap-3">
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem value="light" id="th-light" />
                      <Label htmlFor="th-light" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5">
                        <Sun className="size-4 text-amber-500" />
                        {locale === 'vi' ? 'Sáng' : 'Light'}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem value="dark" id="th-dark" />
                      <Label htmlFor="th-dark" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5">
                        <Moon className="size-4 text-blue-500" />
                        {locale === 'vi' ? 'Đậm' : 'Dark'}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem value="system" id="th-system" />
                      <Label htmlFor="th-system" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5">
                        <Laptop className="size-4 text-slate-400" />
                        {locale === 'vi' ? 'Theo giá trị mặc định của thiết bị' : 'Device default'}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Density/Mật độ Section */}
              <div className="space-y-4 pt-6">
                <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                  <Grid className="size-4.5 text-blue-600" />
                  {locale === 'vi' ? 'Mật độ' : 'Density'}
                </h3>
                <div className="max-w-xl">
                  <RadioGroup value={density} onValueChange={handleDensityChange} className="flex flex-col gap-3">
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem value="low" id="ds-low" />
                      <Label htmlFor="ds-low" className="text-xs font-semibold text-slate-700 cursor-pointer">
                        {locale === 'vi' ? 'Thấp (Mật độ thưa)' : 'Low (Cozy)'}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2.5">
                      <RadioGroupItem value="medium" id="ds-medium" />
                      <Label htmlFor="ds-medium" className="text-xs font-semibold text-slate-700 cursor-pointer">
                        {locale === 'vi' ? 'Trung bình (Mặc định)' : 'Medium (Default)'}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          {/* TAB: AI ASSISTANT / OPENAI CONFIG */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
                <Bot className="size-5 text-blue-600" />
                <h3 className="text-md font-bold text-slate-800">
                  {locale === 'vi' ? 'Cấu hình OpenAI & Trợ lý ảo' : 'AI Assistant Configuration'}
                </h3>
              </div>
              {/* Render in-place the existing OpenAI Settings section */}
              <OpenAiSettingsSection />
            </div>
          )}

          {/* TAB: PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Shield className="size-5 text-blue-600" />
                <h3 className="text-md font-bold text-slate-800">
                  {locale === 'vi' ? 'Quyền riêng tư & Bảo mật dữ liệu' : 'Privacy & Security'}
                </h3>
              </div>
              
              <div className="space-y-4 max-w-xl">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {locale === 'vi'
                    ? 'Quản lý cách thông tin và lịch sử tương tác tài liệu của bạn được thu thập và xử lý nhằm mục đích thống kê hoạt động trong tổ chức.'
                    : 'Manage how your document interaction history and stats are collected and processed for organizational analytics.'}
                </p>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">
                        {locale === 'vi' ? 'Thống kê hoạt động ẩn danh' : 'Anonymous Activity Statistics'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 max-w-[340px] leading-normal">
                        {locale === 'vi'
                          ? 'Cho phép gửi dữ liệu phân tích thời lượng xem tài liệu một cách bảo mật ẩn danh.'
                          : 'Allow sending anonymous viewing analytics to improve internal search recommendations.'}
                      </span>
                    </div>
                    <Switch checked={shareDataAnalytics} onCheckedChange={setShareDataAnalytics} />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">
                        {locale === 'vi' ? 'Ghi nhật ký kiểm thử (Audit log)' : 'Detailed Audit Logging'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 max-w-[340px] leading-normal">
                        {locale === 'vi'
                          ? 'Tự động ghi lại lịch sử truy xuất tệp và sửa đổi tài liệu phục vụ quy trình quản lý chất lượng.'
                          : 'Automatically record file fetch and template editing history for quality compliance.'}
                      </span>
                    </div>
                    <Switch checked={enableAuditLogs} onCheckedChange={setEnableAuditLogs} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Bell className="size-5 text-blue-600" />
                <h3 className="text-md font-bold text-slate-800">
                  {locale === 'vi' ? 'Cài đặt thông báo nhận' : 'Notification Preferences'}
                </h3>
              </div>

              <div className="space-y-4 max-w-xl">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {locale === 'vi'
                    ? 'Tuỳ chỉnh các kênh thông báo chính thức để nhận các cập nhật trạng thái xét duyệt và phản hồi tài liệu nhanh nhất.'
                    : 'Customize how you want to be notified about workflow steps, comment discussions, and updates.'}
                </p>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">
                        {locale === 'vi' ? 'Yêu cầu phê duyệt cần xử lý' : 'Pending Approval Requests'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 max-w-[340px] leading-normal">
                        {locale === 'vi'
                          ? 'Thông báo tức thời khi có tài liệu mới được gửi cần sự phê duyệt của vai trò bạn đảm nhận.'
                          : 'Instant notifications when a new document requires your review or approval.'}
                      </span>
                    </div>
                    <Switch checked={notifyApprovals} onCheckedChange={setNotifyApprovals} />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">
                        {locale === 'vi' ? 'Nhận xét và Đề xuất trên tài liệu' : 'Comments & Suggestions'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 max-w-[340px] leading-normal">
                        {locale === 'vi'
                          ? 'Nhận thông báo khi có người để lại nhận xét trên tài liệu do bạn tạo hoặc đang theo dõi.'
                          : 'Notify me when someone posts a comment on my documents or mentions me.'}
                      </span>
                    </div>
                    <Switch checked={notifyComments} onCheckedChange={setNotifyComments} />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">
                        {locale === 'vi' ? 'Thông báo cập nhật phát hành định kỳ' : 'Weekly Digest Updates'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 max-w-[340px] leading-normal">
                        {locale === 'vi'
                          ? 'Nhận email tổng hợp hàng tuần về danh sách tài liệu mới được ban hành chính thức trong tổ chức.'
                          : 'Receive weekly summary emails about newly published official documents.'}
                      </span>
                    </div>
                    <Switch checked={notifyUpdates} onCheckedChange={setNotifyUpdates} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: MANAGE APPS */}
          {activeTab === 'apps' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Grid className="size-5 text-blue-600" />
                <h3 className="text-md font-bold text-slate-800">
                  {locale === 'vi' ? 'Ứng dụng liên kết' : 'Connected Applications'}
                </h3>
              </div>

              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xl">
                {locale === 'vi'
                  ? 'Quản lý các ứng dụng và tiện ích mở rộng bên thứ ba được phép truy cập và biên tập dữ liệu tệp trong Document Control.'
                  : 'Manage third-party editor applications and plugins authorized to access files in Document Control.'}
              </p>

              <div className="space-y-3 max-w-xl pt-2">
                {/* App 1 */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shrink-0">
                      <FileText className="size-4.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Microsoft Word Online</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">{locale === 'vi' ? 'Trình soạn thảo mặc định' : 'Default rich text editor'}</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2.5 py-1 rounded-full border border-slate-200">
                    {locale === 'vi' ? 'Đang hoạt động' : 'Active'}
                  </span>
                </div>

                {/* App 2 */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600 shrink-0">
                      <Bot className="size-4.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">GDU AI Assistant Integration</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">{locale === 'vi' ? 'Trích xuất và gợi ý thông tin mẫu' : 'Information extraction and recommendations'}</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2.5 py-1 rounded-full border border-slate-200">
                    {locale === 'vi' ? 'Đang hoạt động' : 'Active'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Storage Details Dialog */}
      <Dialog open={showStorageDetails} onOpenChange={setShowStorageDetails}>
        <DialogContent className="max-w-lg bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <HardDrive className="size-5 text-blue-600" />
              {locale === 'vi' ? 'Các mục chiếm dung lượng bộ nhớ' : 'Storage Space Details'}
            </DialogTitle>
          </DialogHeader>

          {/* Storage list */}
          <div className="my-4 max-h-[300px] overflow-y-auto space-y-2.5 pr-1">
            {STORAGE_MOCK_FILES.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition duration-150"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {renderFileIcon(file.type)}
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[280px]">
                    {file.name}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-500 shrink-0">
                  {formatBytes(file.size)}
                </span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowStorageDetails(false)}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold px-5 text-xs text-white"
            >
              {locale === 'vi' ? 'Đóng' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
