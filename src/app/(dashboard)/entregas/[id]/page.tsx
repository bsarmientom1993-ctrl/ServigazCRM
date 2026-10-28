import { DeliveryReceipt } from '@/components/material-documents';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <DeliveryReceipt id={id}/>;}
