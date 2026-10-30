'use client';
import {Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {PendingQuotes} from '@/components/PendingQuotes';
import {useAuth} from '@/context/AuthContext';
function FilteredQuotes(){const params=useSearchParams();return <PendingQuotes initialGroup={params.get('estado')||''}/>;}
export default function QuotesPage(){const {user}=useAuth();if(user?.rol==='TECNICO_FIJO')return <p className="module-error" role="alert">Las cotizaciones están disponibles para encargados y administradores.</p>;return <Suspense fallback={<p className="module-note" role="status">Abriendo cotizaciones…</p>}><FilteredQuotes/></Suspense>;}
