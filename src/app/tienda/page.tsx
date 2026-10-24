import type { Metadata } from 'next';
import { PublicStore } from '@/components/PublicStore';
export const metadata: Metadata = { title: 'Tienda Servigaz · Equipos y materiales', description: 'Equipos y materiales de gas, calefacción y plomería. Arma tu pedido y consulta con Servigaz por WhatsApp.' };
export default function StorePage(){return <PublicStore/>;}
