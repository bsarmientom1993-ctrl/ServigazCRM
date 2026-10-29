'use client';
import { use } from 'react';
import { WarrantyLabelPrint } from '@/components/trabajos/WarrantyLabels';
export default function Page({params}:{params:Promise<{id:string;labelId:string}>}) {
  const {id,labelId}=use(params);
  return <WarrantyLabelPrint workId={id} labelId={labelId}/>;
}
