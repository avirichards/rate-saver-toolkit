// Simple API Client for localhost:5000 backend
interface APIResponse<T = any> {
  data?: T;
  error?: { message: string };
}

class SimpleAPIClient {
  private baseURL = 'http://localhost:5000/api';
  
  // Helper method for making authenticated requests
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<APIResponse<T>> {
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

  // Generic table operations
  async selectFrom(table: string, options: {
    columns?: string;
    filters?: Record<string, any>;
    order?: string;
    limit?: number;
    single?: boolean;
  } = {}) {
    const params = new URLSearchParams();
    
    if (options.columns) params.set('select', options.columns);
    if (options.order) params.set('order', options.order);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.single) params.set('single', 'true');
    
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        params.set(key, String(value));
      });
    }

    return await this.request(`/${table}?${params.toString()}`);
  }

  async insertInto(table: string, data: any, options: { select?: string; single?: boolean } = {}) {
    return await this.request(`/${table}`, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        ...(options.select && { _select: options.select }),
        ...(options.single && { _single: true })
      })
    });
  }

  async updateTable(table: string, data: any, where: Record<string, any>) {
    return await this.request(`/${table}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, _where: where })
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

// For backward compatibility - proper Supabase-like interface
export const supabase = {
  auth: {
    getUser: async () => {
      const response = await apiClient.getUser();
      return { data: { user: (response.data as any)?.user }, error: response.error };
    },
    getSession: async () => ({ data: { session: null }, error: null }),
    signUp: async (options: any) => ({ error: null }),
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      const response = await apiClient.signIn(credentials.email, credentials.password);
      return { data: { user: (response.data as any)?.user, access_token: (response.data as any)?.access_token }, error: response.error };
    },
    signOut: () => apiClient.signOut(),
    onAuthStateChange: (callback: Function) => ({ data: { subscription: { unsubscribe: () => {} } } })
  },

  from: (table: string) => ({
    select: (columns: string = '*') => {
      const query = { select: columns, filters: {} as any };
      
      const buildQuery = (currentQuery: any) => ({
        eq: (column: string, value: any) => {
          const newQuery = { ...currentQuery, filters: { ...currentQuery.filters, [column]: value } };
          return {
            ...buildQuery(newQuery),
            single: async () => apiClient.selectFrom(table, { ...newQuery, single: true }),
            then: (resolve: Function) => apiClient.selectFrom(table, newQuery).then(resolve)
          };
        },
        
        not: (column: string, operator: string, value: any) => {
          const newQuery = { ...currentQuery, filters: { ...currentQuery.filters, [`${column}_not_${operator}`]: value } };
          return buildQuery(newQuery);
        },
        
        in: (column: string, values: any[]) => {
          const newQuery = { ...currentQuery, filters: { ...currentQuery.filters, [`${column}_in`]: values.join(',') } };
          return buildQuery(newQuery);
        },
        
        order: (column: string, options: any = { ascending: true }) => {
          const newQuery = { ...currentQuery, order: `${column}:${options.ascending ? 'asc' : 'desc'}` };
          return {
            ...buildQuery(newQuery),
            then: (resolve: Function) => apiClient.selectFrom(table, newQuery).then(resolve)
          };
        },
        
        limit: (count: number) => {
          const newQuery = { ...currentQuery, limit: count };
          return {
            ...buildQuery(newQuery),
            then: (resolve: Function) => apiClient.selectFrom(table, newQuery).then(resolve)
          };
        },
        
        single: async () => apiClient.selectFrom(table, { ...currentQuery, single: true }),
        
        then: (resolve: Function) => apiClient.selectFrom(table, currentQuery).then(resolve)
      });
      
      return buildQuery(query);
    },

    insert: (data: any) => ({
      select: (columns: string = '*') => ({
        single: async () => apiClient.insertInto(table, data, { select: columns, single: true })
      })
    }),

    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        then: (resolve: Function) => apiClient.updateTable(table, data, { [column]: value }).then(resolve)
      })
    }),

    delete: () => ({
      eq: (column: string, value: any) => ({
        then: (resolve: Function) => apiClient.request(`/${table}`, {
          method: 'DELETE',
          body: JSON.stringify({ _where: { [column]: value } })
        }).then(resolve)
      })
    })
  }),

  functions: {
    invoke: (name: string, options: any) => apiClient.invokeFunction(name, options.body)
  }
};