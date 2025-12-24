import { handlers } from '@/lib/auth';
import { NextRequest } from 'next/server';

const wrappedGET = async (req: NextRequest) => {
  try {
    console.log('[auth route] GET request:', req.url);
    return await handlers.GET(req);
  } catch (error) {
    console.error('[auth route] GET error:', error);
    throw error;
  }
};

const wrappedPOST = async (req: NextRequest) => {
  try {
    console.log('[auth route] POST request:', req.url);
    return await handlers.POST(req);
  } catch (error) {
    console.error('[auth route] POST error:', error);
    throw error;
  }
};

export { wrappedGET as GET, wrappedPOST as POST };
