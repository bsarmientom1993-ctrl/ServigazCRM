const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');const {NextRequest}=require('next/server');const jwt=require('jsonwebtoken');
const db={};const load=Module._load;Module._load=function(request,parent,...args){if(request==='@/lib/prisma'||request==='./prisma'&&/[/\\]lib[/\\](auth|pending-quotes)\.ts$/.test(parent?.filename||''))return{prisma:db};return load.call(this,request,parent,...args);};
process.env.JWT_SECRET='pending-quotes-local-unit-test-secret';
const {pendingQuote,pendingQuotes}=require('../src/lib/pending-quotes.ts');const route=require('../src/app/api/cotizaciones/pendientes/route.ts');
const now=new Date('2026-10-24T16:00:00Z');
const work={id:'w1',codigoCorrelativo:'TRB-1',cliente:{nombreCompleto:'Cliente de prueba'},subtipoNombre:'Instalación',estado:'EVALUADO',createdAt:'2026-10-20T12:00:00Z',cotizaciones:[]};
const quote={id:'q1',estado:'VIGENTE',totalCotizado:'120.00',fechaVencimiento:'2026-10-30T23:59:59-04:00'};
test('pending quotations distinguish evaluation, response and expiry without mixing accepted or closed work',()=>{
 assert.equal(pendingQuote(work,now).grupo,'POR_COTIZAR');assert.equal(pendingQuote(work,now).total,null);
 assert.equal(pendingQuote({...work,estado:'EVALUACION_PENDIENTE'},now).accion,'Completar evaluación');
 assert.equal(pendingQuote({...work,estado:'COTIZADO',cotizaciones:[quote]},now).grupo,'ESPERANDO_RESPUESTA');
 assert.equal(pendingQuote({...work,estado:'EN_NEGOCIACION',cotizaciones:[{...quote,fechaVencimiento:now.toISOString()}]},now).grupo,'VENCIDA');
 assert.equal(pendingQuote({...work,estado:'COTIZACION_VENCIDA',cotizaciones:[quote]},now).grupo,'VENCIDA');
 for(const estado of ['APROBADO','FINALIZADO_FINANCIERO','CANCELADO','RECHAZADO'])assert.equal(pendingQuote({...work,estado},now),null);
 assert.equal(pendingQuote({...work,estado:'COTIZADO',cotizaciones:[{...quote,estado:'APROBADA'}]},now),null);
 assert.equal(pendingQuote({...work,cotizaciones:[{...quote,estado:'SUPERADA'}]},now).grupo,'POR_COTIZAR');
});
test('pending list uses authorized work scope and latest quote only with no technical access',async()=>{
 let query;db.trabajo={findMany:async args=>{query=args;return [work,{...work,id:'w2',estado:'COTIZADO',cotizaciones:[{...quote,fechaVencimiento:'2099-01-01T00:00:00Z'}]}];}};
 const session={id:'manager',rol:'ENCARGADO',sucursalId:'branch'};const data=await pendingQuotes(session);
 assert.deepEqual(query.where.AND[0],{OR:[{sucursalId:'branch'},{encargadoId:'manager'}]});assert.deepEqual(query.select.cotizaciones.orderBy,{numeroVersion:'desc'});assert.equal(query.select.cotizaciones.take,1);
 assert.deepEqual(data.resumen,{total:2,porCotizar:1,esperandoRespuesta:1,vencidas:0});
 db.usuario={findUnique:async()=>({id:'tech',rol:'TECNICO_FIJO',estado:'ACTIVO'})};
 const request=new NextRequest('http://localhost/api/cotizaciones/pendientes',{headers:{Cookie:'servigaz_token='+jwt.sign({id:'tech'},process.env.JWT_SECRET)}});
 assert.equal((await route.GET(request)).status,403);
});
