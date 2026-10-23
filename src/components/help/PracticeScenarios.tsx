"use client";
import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { exampleProcesses } from '@/lib/practice-scenarios';
import type { ExampleId } from '@/lib/practice';

export function PracticeScenarios({ id }: { id: ExampleId }) {
  const process = exampleProcesses[id];
  const [selected, setSelected] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const possibility = selected === null ? null : process.possibilities[selected];
  return <section className="space-y-4" aria-label="Proceso completo y posibilidades">
    <details className="rounded-xl border border-line p-4">
      <summary className="font-semibold text-ink cursor-pointer">Ver el recorrido completo de este proceso</summary>
      <ol className="mt-4 space-y-3 list-decimal pl-5 text-sm text-secondary">{process.journey.map(item=><li key={item}>{item}</li>)}</ol>
    </details>
    <div><h5 className="font-semibold text-ink">¿Qué otras situaciones pueden ocurrir?</h5><p className="text-xs text-muted mt-1">Explora {process.possibilities.length} alternativas paso a paso y consulta el resultado de cada una. Son ejemplos guiados; no modifican registros reales.</p></div>
    <div className="grid sm:grid-cols-2 gap-2">{process.possibilities.map((item,index)=><button type="button" key={item.title} aria-pressed={selected===index} className={'rounded-xl border p-3 text-sm text-left '+(selected===index?'border-[#F06529] bg-[#F06529]/10 text-ink':'border-line text-secondary bg-wash')} onClick={()=>{setSelected(index);setStep(0);}}>{item.title}</button>)}</div>
    {possibility && <div className="rounded-xl border border-[#F06529]/30 bg-[#F06529]/5 p-4 space-y-4" aria-live="polite">
      <div><p className="module-eyebrow">SITUACIÓN DE EJEMPLO · PASO {step+1} DE {possibility.steps.length}</p><h6 className="font-semibold text-ink mt-1">{possibility.title}</h6></div>
      <p className="text-sm text-secondary leading-relaxed">{possibility.steps[step]}</p>
      <div className="flex flex-wrap gap-2"><button type="button" className="theme-toggle" disabled={step===0} onClick={()=>setStep(previous=>previous-1)}><ArrowLeft size={15}/>Anterior</button><button type="button" className="primary-action" disabled={step===possibility.steps.length-1} onClick={()=>setStep(previous=>previous+1)}>Siguiente paso<ArrowRight size={15}/></button><button type="button" className="theme-toggle" onClick={()=>setSelected(null)}>Cerrar situación</button></div>
      {step===possibility.steps.length-1 && <p className="module-note text-sm"><strong>Resultado: </strong>{possibility.outcome}</p>}
    </div>}
  </section>;
}
