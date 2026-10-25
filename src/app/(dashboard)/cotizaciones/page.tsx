'use client';
import {PendingQuotes} from '@/components/PendingQuotes';
import {useAuth} from '@/context/AuthContext';
export default function QuotesPage(){const {user}=useAuth();if(user?.rol==='TECNICO_FIJO')return <p className="module-error" role="alert">Las cotizaciones están disponibles para encargados y administradores.</p>;return <PendingQuotes/>;}
