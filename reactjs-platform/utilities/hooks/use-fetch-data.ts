import { API } from 'reactjs-platform/utilities';
import { useEffect, useState } from 'react';

// ? pathString is path string where specifice field
export const useFetchData = (url: string, options?: any, _pathString?: string) => {
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState<{ total: number }>({ total: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // console.log('>>options', options);
        const response = await API.get(url, { params: options });
        // console.log('>>response', response);
        const data = response?.data?.data || [];
        const pagination = response?.data?.pagination || { total: 0 };

        setData(data);
        setPagination(pagination);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [url, options]);

  return { data, pagination, error, loading };
};
