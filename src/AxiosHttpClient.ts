import axios, { AxiosInstance } from 'axios';
import { HttpClient } from './HttpClient';

export default class AxiosHttpClient implements HttpClient {
  constructor(private readonly axiosInstance: AxiosInstance = axios.create()) {}

  async get<T>(url: string): Promise<{ data: T }> {
    return this.axiosInstance.get<T>(url);
  }
}
