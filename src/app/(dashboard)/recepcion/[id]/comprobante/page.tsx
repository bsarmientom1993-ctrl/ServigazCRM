'use client';
import {use} from 'react';
import {ReceptionDetail} from '@/components/reception/ReceptionDetail';
export default function Page({params}:{params:Promise<{id:string}>}){const {id}=use(params);return <ReceptionDetail workId={id} receiptOnly/>;}
