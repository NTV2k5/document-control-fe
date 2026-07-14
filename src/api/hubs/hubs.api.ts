import { API } from 'reactjs-platform/utilities';

export interface IDepartmentItem {
  id: string;
  name: string;
  size: string;
  filesCount: number;
  iconKey: 'code' | 'paint' | 'biology' | 'math' | 'folder';
}

export interface IProjectItem {
  id: string;
  name: string;
  size: string;
  partnersCount?: number;
  membersCount?: number;
  filesCount?: number;
  iconKey: 'brain' | 'leaf' | 'rocket' | 'scan' | 'folder';
}

export const listDepartmentsAPI = async (): Promise<IDepartmentItem[]> => {
  return API.get<{ data: IDepartmentItem[] }>('/api/v1/hubs/departments').then(
    (response) => response.data.data,
  );
};

export const archiveDepartmentAPI = async (id: string): Promise<void> => {
  return API.post(`/api/v1/hubs/departments/${id}/archive`).then(() => undefined);
};

export const listProjectsAPI = async (): Promise<IProjectItem[]> => {
  return API.get<{ data: IProjectItem[] }>('/api/v1/hubs/projects').then(
    (response) => response.data.data,
  );
};

export const archiveProjectAPI = async (id: string): Promise<void> => {
  return API.post(`/api/v1/hubs/projects/${id}/archive`).then(() => undefined);
};
