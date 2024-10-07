import axios, { AxiosInstance, AxiosResponse } from 'axios';
import AxiosHttpClient from './AxiosHttpClient';

jest.mock('axios');

describe('AxiosHttpClient', () => {
  let axiosHttpClient: AxiosHttpClient;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn(),
      // Add other methods as needed (post, put, delete, etc.)
    } as unknown as jest.Mocked<AxiosInstance>;

    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

    axiosHttpClient = new AxiosHttpClient();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should make a GET request using axios', async () => {
    const mockData = { id: 1, name: 'Test' };
    const mockResponse: AxiosResponse = {
      data: mockData,
      status: 200,
      statusText: 'OK',
      headers: new axios.AxiosHeaders(),
      config: { headers: new axios.AxiosHeaders() },
    };

    mockAxiosInstance.get.mockResolvedValue(mockResponse);

    const result = await axiosHttpClient.get<typeof mockData>('https://api.example.com/data');

    expect(result.data).toEqual(mockData);
    expect(axios.create).toHaveBeenCalledTimes(1);
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('https://api.example.com/data');
  });

  it('should throw an error when the request fails', async () => {
    const mockError = new Error('Network Error');
    mockAxiosInstance.get.mockRejectedValue(mockError);

    await expect(axiosHttpClient.get('https://api.example.com/data')).rejects.toThrow('Network Error');
  });
});
