import {NextRequest,NextResponse} from 'next/server';
import {requireSession} from '@/lib/auth';
import {apiError} from '@/lib/api';
import {prisma} from '@/lib/prisma';
import {attendanceAccess} from '@/lib/attendance-access';
export async function GET(req:NextRequest){try{const user=await requireSession(req);return NextResponse.json(await attendanceAccess(prisma,user.id),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return apiError(e);}}
