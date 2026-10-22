"use client";
import {use} from "react";
import Link from "next/link";
import {WorkPhotoFolders} from "@/components/trabajos/WorkPhotoFolders";
export default function PhotosPage({params}:{params:Promise<{id:string}>}){const {id}=use(params);return <div className="max-w-5xl mx-auto space-y-4"><Link className="theme-toggle" href="/fotos">Todos los registros fotográficos</Link><WorkPhotoFolders workId={id}/></div>;}
