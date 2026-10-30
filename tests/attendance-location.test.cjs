const {test}=require('node:test');
const assert=require('node:assert/strict');
const {getAttendancePosition,AttendanceLocationError}=require('../src/lib/attendance-location.ts');

test('location requests a fresh high-accuracy sample on every explicit call',async()=>{
 let calls=0;const geolocation={getCurrentPosition(success,failure,options){calls++;assert.deepEqual(options,{enableHighAccuracy:true,maximumAge:0,timeout:20000});success({coords:{latitude:-16.5,longitude:-68.15,accuracy:2},timestamp:Date.UTC(2026,9,30,12,0,calls)});}};
 const first=await getAttendancePosition({secureContext:true,geolocation});
 const second=await getAttendancePosition({secureContext:true,geolocation});
 assert.equal(calls,2);assert.deepEqual(first,{latitud:-16.5,longitud:-68.15,precisionMetros:2,muestraAt:'2026-10-30T12:00:01.000Z'});assert.notEqual(first.muestraAt,second.muestraAt);
});
test('blocked permission, unavailable GPS and timeout provide distinct recovery messages',async()=>{
 for(const [code,reason,message] of [[1,'blocked',/ajustes del navegador/],[2,'unavailable',/ubicación del teléfono/],[3,'timeout',/tardó demasiado/]])await assert.rejects(getAttendancePosition({secureContext:true,geolocation:{getCurrentPosition(success,failure){failure({code});}}}),error=>error instanceof AttendanceLocationError&&error.reason===reason&&message.test(error.message));
});
test('unsupported browser and insecure origin do not attempt GPS',async()=>{
 await assert.rejects(getAttendancePosition({secureContext:true}),error=>error.reason==='unavailable');
 await assert.rejects(getAttendancePosition({secureContext:false,geolocation:{getCurrentPosition(){assert.fail('GPS requested over insecure origin');}}}),error=>error.reason==='insecure');
});
