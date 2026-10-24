const {test}=require('node:test');const assert=require('node:assert/strict');
const {storeCart,storeWhatsApp,storeConfigSchema,defaultStoreConfig}=require('../src/lib/store.ts');
const product={id:'one',nombre:'Válvula & conexión',codigoSku:'VAL-1',categoria:'Gas',unidadMedida:'unidad',precio:10.29,descripcion:'',destacado:false,imagen:null};
test('public cart computes cents from catalog prices and excludes removed products or invalid quantities',()=>{
 const lines=storeCart([product],[{productoId:'one',cantidad:3},{productoId:'removed',cantidad:2}]);
 assert.equal(lines.length,1);assert.equal(lines[0].subtotal,3087);
 for(const cantidad of [0,-1,1.2,100,NaN])assert.equal(storeCart([product],[{productoId:'one',cantidad}]).length,0);
});
test('WhatsApp link encodes item details, Bolivia phone and explicitly requests confirmation',()=>{
 const url=new URL(storeWhatsApp('70000000',[product],[{productoId:'one',cantidad:3}]));
 assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/59170000000');
 for(const text of ['Válvula & conexión','VAL-1','30,87','confirmen disponibilidad'])assert.ok(url.searchParams.get('text').includes(text));
 assert.equal(storeWhatsApp('invalid',[product],[{productoId:'one',cantidad:1}]),null);
 assert.equal(storeWhatsApp('70000000',[],[{productoId:'one',cantidad:1}]),null);
});
test('opening storefront requires a valid commercial WhatsApp',()=>{
 assert.equal(storeConfigSchema.safeParse({...defaultStoreConfig,activa:true}).success,false);
 assert.equal(storeConfigSchema.safeParse({...defaultStoreConfig,activa:true,whatsapp:'+591 70000000'}).success,true);
});
