const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const fs=require('node:fs');const path=require('node:path');
const {PrismaClient}=require('@prisma/client');const {NextRequest}=require('next/server');const jwt=require('jsonwebtoken');
const supplied=process.env.TEST_DATABASE_URL;if(!supplied)throw new Error('Se requiere PostgreSQL local _test.');
const base=new URL(supplied);if(!['127.0.0.1','localhost'].includes(base.hostname)||!base.pathname.endsWith('_test'))throw new Error('Solo se permiten pruebas locales.');
const schema='store_test_'+randomUUID().replaceAll('-','');const root=new PrismaClient({datasources:{db:{url:base.toString()}}});const scoped=new URL(base);scoped.searchParams.set('schema',schema);process.env.DATABASE_URL=scoped.toString();process.env.JWT_SECRET='store-local-integration-secret-only';process.env.PHOTO_STORAGE='postgres';
const {prisma}=require('../src/lib/prisma.ts');const adminRoute=require('../src/app/api/gestion-tienda/route.ts');const catalog=require('../src/app/api/tienda/route.ts');const photos=require('../src/app/api/tienda/imagenes/[id]/route.ts');const {defaultStoreConfig}=require('../src/lib/store.ts');
let admin,manager,technician,product;
function req(user,data,method='PUT'){return new NextRequest('http://localhost/api/gestion-tienda',{method,headers:{'Content-Type':'application/json',...(user?{Cookie:'servigaz_token='+jwt.sign({id:user.id},process.env.JWT_SECRET)}:{})},...(method==='GET'?{}:{body:JSON.stringify(data)})});}
async function body(response,status=200){const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
before(async()=>{
 await root.$executeRawUnsafe('CREATE SCHEMA "'+schema+'"');
 const sql=fs.readFileSync(path.join(__dirname,'fixtures/inventory-baseline.sql'),'utf8');await prisma.$transaction(async tx=>{for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);},{timeout:60000});
 await require('../scripts/migrate-store.cjs').migrateStore(prisma);await require('../scripts/migrate-store.cjs').migrateStore(prisma);
 async function user(rol){return prisma.usuario.create({data:{nombre:rol,email:randomUUID()+'@example.invalid',passwordHash:'unused',rol}});}
 admin=await user('ADMIN');manager=await user('ENCARGADO');technician=await user('TECNICO_FIJO');
 product=await prisma.productoInventario.create({data:{nombre:'Equipo de prueba',codigoSku:'PRIVATE-TEST',categoria:'Equipos',unidadMedida:'unidad',precioVenta:120,costoPromedio:70,stockActual:50}});
},{timeout:60000});
after(async()=>{await prisma.$disconnect();if(/^store_test_[a-f0-9]{32}$/.test(schema))await root.$executeRawUnsafe('DROP SCHEMA "'+schema+'" CASCADE');await root.$disconnect();});
const publish=()=>({accion:'PRODUCTO',productoId:product.id,descripcion:'Descripción pública',publicado:true,destacado:true,precio:123.45});
const open=()=>({accion:'CONFIGURACION',config:{...defaultStoreConfig,activa:true,whatsapp:'+59170000000'}});
test('store management rejects missing session and non-administrators',async()=>{
 for(const actor of [null,manager,technician]){await body(await adminRoute.GET(req(actor,null,'GET')),actor?403:401);await body(await adminRoute.PUT(req(actor,open())),actor?403:401);}
 assert.equal(await prisma.tiendaConfiguracion.count(),0);
});
test('public catalog exposes only explicitly published active products and never private inventory fields',async()=>{
 assert.deepEqual((await body(await catalog.GET())).productos,[]);
 await body(await adminRoute.PUT(req(admin,open())));
 assert.deepEqual((await body(await catalog.GET())).productos,[]);
 await body(await adminRoute.PUT(req(admin,publish())));
 const data=await body(await catalog.GET());assert.equal(data.productos.length,1);assert.equal(data.productos[0].precio,123.45);
 assert.deepEqual(Object.keys(data.productos[0]).sort(),['id','nombre','codigoSku','categoria','unidadMedida','precio','descripcion','destacado','imagen'].sort());
 for(const field of ['costoPromedio','stockActual','usuarioId','existencias'])assert.equal(JSON.stringify(data).includes(field),false);
 assert.equal(Number((await prisma.productoInventario.findUnique({where:{id:product.id}})).stockActual),50);
 await prisma.productoInventario.update({where:{id:product.id},data:{activo:false}});assert.equal((await body(await catalog.GET())).productos.length,0);
 await prisma.productoInventario.update({where:{id:product.id},data:{activo:true}});
});
test('catalog photographs are reencoded and hidden immediately when unpublished or shop closes',async()=>{
 const image=await require('sharp')({create:{width:80,height:80,channels:3,background:'#eeeeee'}}).png().toBuffer();
 await body(await adminRoute.PUT(req(admin,{...publish(),imagen:'data:image/png;base64,'+image.toString('base64')})));
 const context={params:Promise.resolve({id:product.id})};const response=await photos.GET(req(null,null,'GET'),context);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');
 await body(await adminRoute.PUT(req(admin,{...publish(),publicado:false})));
 assert.equal((await body(await catalog.GET())).productos.length,0);await body(await photos.GET(req(null,null,'GET'),context),404);
 await body(await adminRoute.PUT(req(admin,publish())));
 await body(await adminRoute.PUT(req(admin,{accion:'CONFIGURACION',config:defaultStoreConfig})));
 assert.equal((await body(await catalog.GET())).productos.length,0);await body(await photos.GET(req(null,null,'GET'),context),404);
});
test('shop rejects invalid prices, phone and executable image sources',async()=>{
 await body(await adminRoute.PUT(req(admin,{...publish(),precio:1.111})),400);
 await body(await adminRoute.PUT(req(admin,{...open(),config:{...open().config,whatsapp:'invalid'}})),400);
 await body(await adminRoute.PUT(req(admin,{...publish(),imagen:'data:image/svg+xml;base64,PHN2Zz4='})),400);
 await body(await adminRoute.PUT(req(admin,{...publish(),imagen:'data:image/png;base64,YmFk'})),400);
});
