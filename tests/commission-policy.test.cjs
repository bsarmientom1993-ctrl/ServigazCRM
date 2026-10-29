const {test}=require('node:test');const assert=require('node:assert/strict');const {commissionCents}=require('../src/lib/commission-policy.ts');
test('commissions round once to a cent, handle losses and use integer arithmetic for large bases',()=>{
 assert.equal(commissionCents(100000,5),5000);assert.equal(commissionCents(65000,5),3250);
 assert.equal(commissionCents(1,50),1);assert.equal(commissionCents(-100,10),0);assert.equal(commissionCents(999999999999,100),999999999999);
});
