export interface IProfileUserInfo {
  first_name: string;
  last_name: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  employee_id: string;
  department: string | null;
  bio: string | null;
  campus: string | null;
  role: string | null;
  user_image: string | null;
}

export interface IProfileStorageCategory {
  bytes: number;
  percentage: number;
}

export interface IProfileStorage {
  used_bytes: number;
  limit_bytes: number;
  percentage_used: number;
  categories: {
    documents: IProfileStorageCategory;
    media: IProfileStorageCategory;
  };
}

export interface IProfileRecentActivity {
  title: string;
  type: string;
  time: string;
  icon: string;
}

export interface IProfileDashboardData {
  user_info: IProfileUserInfo;
  storage: IProfileStorage;
  recent_activity: IProfileRecentActivity[];
}

export interface IUpdateProfilePayload {
  phone?: string;
  bio?: string;
}

export interface IUpdateProfileResponse {
  status: string;
  message: string;
  data_received: {
    phone?: string;
    bio?: string;
  };
}
