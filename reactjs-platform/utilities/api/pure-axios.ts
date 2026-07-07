import axios from 'axios';
import { API_ENDPOINT } from '../constants';

export const pureAxios = axios.create({
  baseURL: API_ENDPOINT,
  headers: {
    'Content-Type': 'application/json',
  },
});
