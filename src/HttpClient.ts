export interface HttpClient {
  get<T>(url: string): Promise<{ data: T }>;
}
