import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { Task, CreateTaskRequest, UpdateTaskRequest, AuthResponse, LoginRequest } from '../types';

class ApiService {
    private axiosInstance: AxiosInstance;
    private baseURL: string;

    constructor() {
        this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
        
        this.axiosInstance = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' },
        });

        this.axiosInstance.interceptors.request.use(
            (config: InternalAxiosRequestConfig) => {
                const token = localStorage.getItem('accessToken');
                if (token && config.headers) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        this.axiosInstance.interceptors.response.use(
            (response: AxiosResponse) => response,
            async (error) => {
                const originalRequest = error.config;
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;
                    try {
                        const refreshToken = localStorage.getItem('refreshToken');
                        if (!refreshToken) throw new Error('No refresh token available');

                        const response = await axios.post<AuthResponse>(
                            `${this.baseURL}/auth/refresh`,
                            { refreshToken }
                        );

                        const { accessToken, refreshToken: newRefreshToken } = response.data;
                        localStorage.setItem('accessToken', accessToken);
                        localStorage.setItem('refreshToken', newRefreshToken);

                        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                        return this.axiosInstance(originalRequest);
                    } catch (refreshError) {
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('refreshToken');
                        window.location.href = '/login';
                        return Promise.reject(refreshError);
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    async login(credentials: LoginRequest): Promise<AuthResponse> {
        const response = await this.axiosInstance.post<AuthResponse>('/auth/login', credentials);
        return response.data;
    }

    async getTasks(): Promise<Task[]> {
        const response = await this.axiosInstance.get<Task[]>('/tasks');
        return response.data;
    }

    async updateTaskStatus(id: number, status: string): Promise<Task> {
        const response = await this.axiosInstance.put<Task>(`/tasks/${id}/status`, { status });
        return response.data;
    }
}

export const apiService = new ApiService();