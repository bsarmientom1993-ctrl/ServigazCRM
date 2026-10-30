import type {NextRequest} from 'next/server';
import {requireSession} from './auth';
import {requireProfessional} from './professional-auth';
export async function notificationOwner(req:NextRequest){return req.nextUrl.searchParams.get('portal')==='1'?'profesional:'+(await requireProfessional(req)).id:'personal:'+(await requireSession(req)).id;}
