import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  'http://localhost:8000';

type Context = {
  params: Promise<{ path: string[] }>;
};

async function handler(request: NextRequest, context: Context) {
  const { path } = await context.params;

  if (!path || path.length === 0) {
    return NextResponse.json(
      { success: false, message: 'Invalid proxy path' },
      { status: 400 }
    );
  }

  const pathStr = path.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const targetUrl =
    `${BACKEND_URL}/api/${pathStr}` +
    (searchParams ? `?${searchParams}` : '');

  // ✅ Log để debug — xem trong terminal `next dev`
  console.log(`[PROXY] ${request.method} /api/proxy/${pathStr} → ${targetUrl}`);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };

  const auth = request.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;

  let body: string | undefined;
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    body = await request.text();
  }

  try {
    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      // Bỏ cache để luôn lấy dữ liệu mới nhất
      cache: 'no-store',
    });

    const text = await res.text();

    // Log lỗi từ backend
    if (!res.ok) {
      console.error(`[PROXY] Backend error ${res.status}:`, text.slice(0, 200));
    }

    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[PROXY] Fetch failed:', err.message);
    console.error('[PROXY] Target was:', targetUrl);
    console.error('[PROXY] BACKEND_URL env:', BACKEND_URL);

    return NextResponse.json(
      {
        success: false,
        message: `Lỗi kết nối backend: ${err.message}`,
        debug: {
          target: targetUrl,
          backend_url: BACKEND_URL,
          hint: BACKEND_URL === 'http://localhost:8000'
            ? 'NEXT_PUBLIC_API_URL chưa được set trong .env.local — hãy set URL ngrok'
            : 'Backend không phản hồi — kiểm tra server có đang chạy không',
        },
      },
      { status: 503 }
    );
  }
}

export const GET    = handler;
export const POST   = handler;
export const PUT    = handler;
export const PATCH  = handler;
export const DELETE = handler;

export function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
  });
}