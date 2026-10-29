const {test}=require('node:test');const assert=require('node:assert/strict');
const {groupCustomerRecords,completedCustomerWorkStates}=require('../src/lib/customer-directory.ts');
test('directory groups matching names and contacts without merging homonyms or sharing a family phone across different names',()=>{
 const rows=[{id:'a',nombreCompleto:'José Mamani',telefonos:['+591 70000001'],email:null},{id:'b',nombreCompleto:'  JOSE  MAMANI ',telefonos:['70000001'],email:null},{id:'c',nombreCompleto:'José Mamani',telefonos:['70000002'],email:null},{id:'d',nombreCompleto:'Ana Mamani',telefonos:['70000001'],email:null}];
 const original=JSON.stringify(rows),groups=groupCustomerRecords(rows);assert.equal(groups.length,3);const jose=groups.find(g=>g.id==='a');assert.deepEqual(jose.registrosIds,['a','b']);assert.equal(jose.telefonos.length,1);assert.equal(JSON.stringify(rows),original);
});
test('email identifies a duplicate while missing contacts do not merge people by name alone',()=>{
 const groups=groupCustomerRecords([{id:'a',nombreCompleto:'Ana Pérez',telefonos:[],email:'ANA@example.invalid'},{id:'b',nombreCompleto:'Ana Perez',telefonos:[],email:'ana@example.invalid'},{id:'c',nombreCompleto:'Ana Perez',telefonos:[]},{id:'d',nombreCompleto:'Ana Perez',telefonos:[]}]);
 assert.equal(groups.length,3);assert.deepEqual(groups.find(g=>g.id==='a').registrosIds,['a','b']);
 assert.deepEqual(completedCustomerWorkStates.sort(),['ARCHIVADO','CANCELADO','FINALIZADO_FINANCIERO','RECHAZADO'].sort());
});
