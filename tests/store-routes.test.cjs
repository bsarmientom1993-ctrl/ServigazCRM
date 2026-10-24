const {test,beforeEach}=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');const {NextRequest}=require('next/server');const jwt=require('jsonwebtoken');
const db={};const load=Module._load;Module._load=function(request,parent,...args){if(request==='@/lib/prisma'||(parent?.filename.endsWith('auth.ts')&&request==='./prisma'))return{prisma:db};return load.call(this,request,parent,...args);};
process.env.JWT_SECRET='store-unit-route-testing-secret-only';process.env.PHOTO_STORAGE='postgres';
const {defaultStoreConfig}=require('../src/lib/store.ts');const route=require('../src/app/api/tienda/route.ts');const admin=require('../src/app/api/gestion-tienda/route.ts');const imageRoute=require('../src/app/api/tienda/imagenes/[id]/route.ts');
const id='00000000-0000-4000-8000-000000000001';let actor,config,published,photo,writes,queries;
function req(data,authenticated=true,method='PUT'){return new NextRequest('http://localhost/api/gestion-tienda',{method,headers:{'Content-Type':'application/json',...(authenticated?{Cookie:'servigaz_token='+jwt.sign({id:'admin'},process.env.JWT_SECRET)}:{})},...(method==='GET'?{}:{body:JSON.stringify(data)})});}
beforeEach(()=>{
 actor={id:'admin',rol:'ADMIN',estado:'ACTIVO'};config={...defaultStoreConfig};published=false;photo=null;writes=[];queries=[];
 db.usuario={findUnique:async()=>actor};db.$transaction=async fn=>fn(db);
 db.tiendaConfiguracion={findUnique:async()=>({datos:config}),upsert:async args=>{config=args.update.datos;writes.push(args);}};
 db.productoInventario={findUnique:async()=>({id,activo:true}),update:async args=>writes.push(args)};
 db.tiendaPublicacion={findMany:async args=>{queries.push(args);return published?[{productoId:id,descripcion:'Público',destacado:false,imagenHash:null,producto:{nombre:'Producto visible',codigoSku:'SKU',categoria:'Equipos',unidadMedida:'unidad',precioVenta:12.34}}]:[];},upsert:async args=>{writes.push(args);published=args.update.publicado;photo=args.update;},findFirst:async args=>{queries.push(args);return published?photo:null;}};
 db.auditoriaLog={create:async args=>writes.push(args)};
});
test('public store stays empty when closed and uses an explicit safe projection when opened',async()=>{
 assert.equal((await(await route.GET()).json()).productos.length,0);assert.equal(queries.length,0);
 config={...config,activa:true,whatsapp:'70000000'};published=true;
 const data=await(await route.GET()).json();assert.equal(data.productos.length,1);
 assert.deepEqual(queries[0].where,{publicado:true,producto:{activo:true,precioVenta:{gt:0}}});
 assert.deepEqual(Object.keys(data.productos[0]).sort(),['id','nombre','codigoSku','categoria','unidadMedida','precio','descripcion','destacado','imagen'].sort());
 const projection=queries[0].select.producto.select;assert.equal(projection.costoPromedio,undefined);assert.equal(projection.stockActual,undefined);
});
test('anonymous and technical users cannot publish or configure public products',async()=>{
 assert.equal((await admin.PUT(req({},false))).status,401);actor.rol='TECNICO_FIJO';assert.equal((await admin.GET(req(null,true,'GET'))).status,403);assert.equal((await admin.PUT(req({}))).status,403);assert.equal(writes.length,0);
});
test('publishing validates real raster bytes, normalizes image and does not mutate stock',async()=>{
 const item={accion:'PRODUCTO',productoId:id,precio:25.5,descripcion:'Ejemplo',publicado:true,destacado:true};
 assert.equal((await admin.PUT(req({...item,imagen:'data:image/png;base64,YmFk'}))).status,400);assert.equal(writes.length,0);
 const bytes=await require('sharp')({create:{width:10,height:10,channels:3,background:'#fff'}}).png().toBuffer();
 assert.equal((await admin.PUT(req({...item,imagen:'data:image/png;base64,'+bytes.toString('base64')}))).status,200);
 assert.equal(published,true);assert.ok(photo.imagenContenido);assert.equal((await require('sharp')(photo.imagenContenido).metadata()).format,'jpeg');
 assert.deepEqual(writes[0].data,{precioVenta:25.5});config={...config,activa:true,whatsapp:'70000000'};
 const context={params:Promise.resolve({id})};assert.equal((await imageRoute.GET(req(null,false,'GET'),context)).status,200);
 published=false;assert.equal((await imageRoute.GET(req(null,false,'GET'),context)).status,404);
});
