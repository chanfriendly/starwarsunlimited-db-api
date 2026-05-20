export const dynamic = 'force-dynamic';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

async function getToken() {
  const { cookies } = await import('next/headers');
  return (await cookies()).get('auth_token')?.value;
}

export async function GET() {
  const token = await getToken();
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const res = await fetch(`${API_URL}/api/me/matches`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function POST(request: Request) {
  const token = await getToken();
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const res = await fetch(`${API_URL}/api/me/matches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
