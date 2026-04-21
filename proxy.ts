import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 只保护面试页面
  if (request.nextUrl.pathname.startsWith('/interview')) {
    // 检查 cookie 里有没有 token（我们在登录成功后会设置）
    const token = request.cookies.get('authing_token');
    
    if (!token) {
      // 未登录，跳转到登录页
      const url = request.nextUrl.clone();
      url.pathname = '/sign-in';
      return NextResponse.redirect(url);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/interview/:path*'],
};