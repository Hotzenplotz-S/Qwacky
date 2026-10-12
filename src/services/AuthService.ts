export class AuthService {
  private headers: Record<string, string>

  constructor() {
    this.headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
    }
  }

  async requestOTP(username: string) {
    try {
      const url = new URL('https://quack.duckduckgo.com/api/auth/loginlink');
      url.searchParams.set('user', username);
      const response = await fetch(
        url.toString(),
        { headers: this.headers }
      )
      if (response.ok) {
        return { status: 'success', needs_otp: true, message: 'OTP sent to your email!' }
      }
      if (response.status === 429) {
        return { status: 'error', message: '请求过于频繁，请稍候再试。' }
      }
      return { status: 'error', message: '发送一次性密码失败，请稍后再试。' }
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        return { status: 'error', message: '网络错误，请检查网络连接。' }
      }
      return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async verifyOTP(username: string, otp: string) {
    try {
      const url = new URL('https://quack.duckduckgo.com/api/auth/login');
      url.searchParams.set('otp', otp);
      url.searchParams.set('user', username);
      const loginResponse = await fetch(
        url.toString(),
        { headers: this.headers }
      )
      if (loginResponse.status === 429) {
        return { status: 'error', message: '请求过于频繁，请稍候再试。' }
      }
      if (!loginResponse.ok) {
        return { status: 'error', message: 'Login failed. Please try again.' }
      }

      let loginData;
      try {
        loginData = await loginResponse.json();
      } catch {
        return { status: 'error', message: '服务器返回了无效响应。' };
      }

      if ('token' in loginData) {
        const headers = { ...this.headers, authorization: `Bearer ${loginData.token}` }
        const dashboardResponse = await fetch(
          'https://quack.duckduckgo.com/api/email/dashboard',
          { headers }
        )

        if (!dashboardResponse.ok) {
          return { status: 'error', message: '加载控制面板数据失败。' }
        }

        let dashboardData;
        try {
          dashboardData = await dashboardResponse.json();
        } catch {
          return { status: 'error', message: '服务器返回了无效响应。' };
        }

        return {
          status: 'success',
          dashboard: dashboardData,
          access_token: loginData.token,
          message: '登录成功！'
        }
      }
      
      return { status: 'error', message: 'Invalid passphrase. Please check the passphrase in your email and try again.' }
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        return { status: 'error', message: '网络错误，请检查网络连接。' }
      }
      return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async generateAddress(token: string) {
    try {
      const headers = { 
        ...this.headers, 
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json'
      }
      
      const response = await fetch(
        'https://quack.duckduckgo.com/api/email/addresses',
        { 
          method: 'POST',
          headers
        }
      )
      
      if (response.status === 401 || response.status === 403) {
        return { status: 'error', message: '会话已过期，请重新登录。' }
      }
      if (response.status === 429) {
        return { status: 'error', message: 'DuckDuckGo 限制了请求频率，请稍后再试。' }
      }
      if (!response.ok) {
        return { status: 'error', message: `DuckDuckGo returned error ${response.status}` }
      }
      
      let data;
      try {
        data = await response.json();
      } catch {
        return { status: 'error', message: '服务器返回了无效响应。' };
      }
      if (data.address) {
        return { 
          status: 'success', 
          address: data.address 
        }
      }
      throw new Error('Invalid response format')
    } catch (error) {
      return { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
} 