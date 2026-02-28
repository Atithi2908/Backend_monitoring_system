import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

export interface Project {
  id: string;
  name: string;
  apiKey: string;
  description?: string | null;
  region: string;
  status: string;
  userId: string;
  createdAt: string;
  apiKeys?: ApiKey[];
  services?: Service[];
  _count?: {
    services: number;
  };
}

export interface ApiKey {
  id: string;
  key: string;
  projectId: string;
  createdAt: string;
  isActive: boolean;
}

export interface Service {
  id: string;
  name: string;
  status: string;
  uptime: number;
  projectId: string;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  region: string;
  status: string;
}

export interface CreateServiceInput {
  projectId: string;
  serviceName: string;
  status: string;
  uptime: number;
}

export interface SystemMetricPoint {
  bucket: string | number;
  avgCpu: number;
  maxCpu: number;
  avgMemoryMb: number;
  maxMemoryMb: number;
}

export interface RequestMetricPoint {
  route: string;
  method: string;
  totalRequests: number;
  successCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  avgResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  minuteBucket?: string | number;
  hourBucket?: string | number;
  dayBucket?: string | number;
}

// Get all projects for user
export async function getProjects(): Promise<Project[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/projects`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch projects');
  }

  const data = await response.json();
  return data.projects;
}

// Get single project details
export async function getProjectDetails(projectId: string): Promise<Project> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch project');
  }

  const data = await response.json();
  return data.project;
}

// Get services for a project
export async function getProjectServices(projectId: string): Promise<Service[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/services`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch services');
  }

  const data = await response.json();
  return data.services;
}

// Create new project (via setup endpoint)
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/create/project`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create project');
  }

  return await response.json();
}

// Create service for a project
export async function createService(input: CreateServiceInput): Promise<Service> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/create/service`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create service');
  }

  const data = await response.json();
  return data.service;
}

// Delete project
export async function deleteProject(projectId: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete project');
  }
}

export async function updateProjectStatus(projectId: string, status: string): Promise<Project> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update project status');
  }

  const data = await response.json();
  return data.project;
}

export async function createProjectApiKey(projectId: string): Promise<string> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/create/apikey/${projectId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create API key');
  }

  const data = await response.json();
  return data.apiKey;
}

export async function getSystemMetrics(
  projectId: string,
  serviceName: string,
  from: number,
  to: number
): Promise<SystemMetricPoint[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const params = new URLSearchParams({
    projectId,
    serviceName,
    from: String(from),
    to: String(to),
  });

  const response = await fetch(`${API_BASE_URL}/metrics/system?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch system metrics');
  }

  return await response.json();
}

export async function getRequestMetrics(
  projectId: string,
  serviceName: string,
  from: number,
  to: number
): Promise<RequestMetricPoint[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const params = new URLSearchParams({
    projectId,
    serviceName,
    from: String(from),
    to: String(to),
  });

  const response = await fetch(`${API_BASE_URL}/metrics/request?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch request metrics');
  }

  return await response.json();
}
