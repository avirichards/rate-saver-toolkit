// Simple API Client for localhost:5000 backend
interface APIResponse<T = any> {
  data?: T;
  error?: { message: string };
}

class SimpleAPIClient {
  private baseURL = 'http://localhost:5000/api';
  
  // Helper method for making authenticated requests
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<APIResponse<T>> {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
        return { error: { message: errorData.message || `HTTP ${response.status}` } };
      }

      const data = await response.json();
      return { data };
    } catch (error: any) {
      return { error: { message: error.message || 'Network error' } };
    }
  }

  // Auth methods - simplified
  async getUser() {
    return await this.request('/auth/user');
  }

  async signIn(email: string, password: string) {
    const response = await this.request('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if ((response.data as any)?.access_token) {
      localStorage.setItem('auth_token', (response.data as any).access_token);
    }
    
    return response;
  }

  async signOut() {
    localStorage.removeItem('auth_token');
    return await this.request('/auth/signout', { method: 'POST' });
  }

  // Analysis endpoints
  async getAnalyses() {
    return await this.request('/analyses');
  }

  async getAnalysisById(id: string) {
    return await this.request(`/analyses/${id}`);
  }

  async createAnalysis(formData: FormData) {
    const token = localStorage.getItem('auth_token');
    
    try {
      const response = await fetch(`${this.baseURL}/analyses`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        return { error: { message: errorData.message || `HTTP ${response.status}` } };
      }

      const data = await response.json();
      return { data };
    } catch (error: any) {
      return { error: { message: error.message || 'Network error' } };
    }
  }

  async getShipments(analysisId: string) {
    return await this.request(`/analyses/${analysisId}/shipments`);
  }

  // Carrier configs
  async getCarrierConfigs() {
    return await this.request('/carrier-configs');
  }

  async createCarrierConfig(data: any) {
    return await this.request('/carrier-configs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCarrierConfig(id: string, data: any) {
    return await this.request(`/carrier-configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteCarrierConfig(id: string) {
    return await this.request(`/carrier-configs/${id}`, {
      method: 'DELETE'
    });
  }

  // Carrier services
  async getCarrierServices() {
    return await this.request('/carrier-services');
  }

  // Clients
  async getClients() {
    return await this.request('/clients');
  }

  async createClient(data: any) {
    return await this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // WebSocket for real-time updates
  createWebSocket() {
    const ws = new WebSocket('ws://localhost:5000/ws');
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return ws;
  }

  // Functions
  async invokeFunction(functionName: string, body: any = {}) {
    return await this.request(`/functions/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
}

export const apiClient = new SimpleAPIClient();