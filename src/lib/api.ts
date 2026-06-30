import { Ticket, User } from '../types.ts';

// Helper to make authenticated requests to our API with exponential backoff retry for network errors
async function apiRequest(path: string, options: RequestInit = {}, retries = 5, delay = 500) {
  const headers = new Headers(options.headers || {});
  
  // Retrieve token from local storage (handles Supabase session and local fallbacks)
  const token = localStorage.getItem('support_mock_auth_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  let lastError: any = null;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(path, {
        ...options,
        headers,
      });
      
      if (!response.ok) {
        const errText = await response.text();
        let parsedErr;
        try {
          parsedErr = JSON.parse(errText);
        } catch {
          parsedErr = { error: errText };
        }
        throw new Error(parsedErr.error || 'API Request failed');
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        const snippet = text.substring(0, 150).trim();
        throw new Error(`Expected JSON response from server but received '${contentType || 'unknown'}' instead. Snippet: ${snippet}`);
      }
      
      return await response.json();
    } catch (err: any) {
      lastError = err;
      const isNetworkError = err instanceof TypeError || 
                             err.message?.includes('fetch') || 
                             err.message?.includes('NetworkError') ||
                             err.message?.includes('Failed to fetch') ||
                             err.message?.includes('Load failed');
      
      if (isNetworkError && i < retries - 1) {
        console.warn(`[API] Connection to ${path} failed, retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('API Request failed');
}

export const api = {
  // Sync authenticated user with DB
  async syncUser(payload: { preferredRole?: string; preferredUsername?: string; partner?: string }): Promise<User> {
    return apiRequest('/api/auth/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Perform sign-in check by email
  async loginByEmail(email: string): Promise<User> {
    return apiRequest('/api/auth/login-by-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Get all tickets
  async getTickets(): Promise<Ticket[]> {
    return apiRequest('/api/tickets');
  },

  // Create new ticket
  async createTicket(ticketData: Omit<Ticket, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Ticket> {
    return apiRequest('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  },

  // Update an existing ticket
  async updateTicket(id: string, updatedFields: Partial<Ticket>): Promise<Ticket> {
    return apiRequest(`/api/tickets/${id}/update`, {
      method: 'POST',
      body: JSON.stringify(updatedFields),
    });
  },

  // Delete an existing ticket
  async deleteTicket(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/tickets/${id}`, {
      method: 'DELETE',
    });
  },

  // Generate an AI suggested response using Gemini
  async suggestReply(payload: {
    issueDescription: string;
    anydeskAddress?: string;
    deviceType?: string;
    partner?: string;
    region?: string;
  }): Promise<{ suggestion: string }> {
    return apiRequest('/api/tickets/suggest-reply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Analyze technical issue from an uploaded photo or image using Gemini
  async analyzeImage(payload: {
    image: string;
    mimeType: string;
  }): Promise<{ description: string }> {
    return apiRequest('/api/tickets/analyze-image', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
};
