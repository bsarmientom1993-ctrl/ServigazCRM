import {NextRequest,NextResponse} from 'next/server';
import {requireSession,managers} from '@/lib/auth';
import {apiError} from '@/lib/api';
import {pendingQuotes} from '@/lib/pending-quotes';
export async function GET(req:NextRequest){try{const user=await requireSession(req,managers);return NextResponse.json(await pendingQuotes(user),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
