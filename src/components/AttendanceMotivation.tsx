'use client';
import {useEffect,useState} from 'react';
import {Pause,Play} from 'lucide-react';
const messages=[
 'Tu trabajo hace que cada hogar sea más seguro. Hoy también haces la diferencia.',
 'Un buen servicio empieza con un gran equipo. Gracias por ser parte de Servigaz.',
 'Cada detalle cuenta: tu experiencia y tu cuidado se notan en cada trabajo.',
 'Paso a paso, servicio a servicio. Hagamos de hoy una gran jornada.',
];
export function AttendanceMotivation(){
 const [index,setIndex]=useState(0),[paused,setPaused]=useState(false);
 useEffect(()=>{if(paused)return;const timer=setInterval(()=>{if(!document.hidden)setIndex(n=>(n+1)%messages.length);},7000);return()=>clearInterval(timer);},[paused]);
 return <div className="attendance-motivation" aria-label="Mensajes para tu jornada"><div className="min-w-0 flex-1"><p key={index} className="attendance-motivation-text">{messages[index]}</p><div className="flex gap-1.5 mt-2" aria-hidden="true">{messages.map((_,i)=><span key={i} className={'h-1 rounded-full transition-all motion-reduce:transition-none '+(i===index?'w-5 bg-orange-500':'w-1.5 bg-orange-500/25')}/>)}</div></div><button type="button" className="theme-toggle shrink-0" aria-label={paused?'Reanudar mensajes automáticos':'Pausar mensajes automáticos'} onClick={()=>setPaused(p=>!p)}>{paused?<Play size={13}/>:<Pause size={13}/>}</button></div>;
}
