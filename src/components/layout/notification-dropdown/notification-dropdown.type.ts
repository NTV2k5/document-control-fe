export interface INotificationItem {
  id: string;
  file_name: string;
  shared_by_name: string;
  shared_by_email: string;
  shared_at: string;
  read: boolean;
  file_size?: number;
  file_type?: string;
  file_url?: string | null;
  user_name?: string;
  raw_item?: any;
}

export interface INotificationDropdownProps {
  onSelectNotification?: (item: INotificationItem) => void;
}
