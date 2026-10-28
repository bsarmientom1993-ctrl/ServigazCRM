const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {QuoteLetter}=require('../src/components/QuoteLetter.tsx');
const {quoteDocumentRows,quoteDate}=require('../src/lib/quote-document.ts');
const quote={numeroVersion:2,estado:'VIGENTE',createdAt:'2026-10-23T16:00:00Z',fechaVencimiento:'2026-11-05T23:59:00-04:00',subtotalMateriales:'1200.00',subtotalManoObra:'1400.00',montoTransporte:'100.00',montoDescuento:'270.00',porcentajeDescuento:10,totalCotizado:'2430.00',anticipoMinimoRequerido:'1215.00',snapshotCalculoJson:{gas:{manoObraLineal:'800.00',importeProyecto:'600.00',metrosTotales:10,metrosVisto:8,metrosEmpotrado:2,promedioPorMetro:'200.00'}},datosFormularioJson:{carta:{cotizadoPorNombre:'Marta Soto',asunto:'Instalación nueva',proyecto:'Vivienda de ejemplo',alcance:'Medidor 1: cocina\nMedidor 2: calefón',nota:'Plazo estimado sujeto a revisión de la entidad.',clienteNombre:'Cliente ficticio'}}};
test('document cost breakdown does not double count gas project or alter saved totals',()=>{
 const rows=quoteDocumentRows(quote);
 assert.equal(rows.reduce((sum,row)=>sum+Number(row.amount),0)-Number(quote.montoDescuento),Number(quote.totalCotizado));
 assert.equal(rows.length,4);assert.equal(rows.filter(row=>/proyecto/.test(row.concept)).length,1);
 assert.equal(quoteDocumentRows({...quote,snapshotCalculoJson:{}}).reduce((sum,row)=>sum+Number(row.amount),0),2700);
});
test('stationery preserves issuer name, validity and escaped scope without a role in signature',()=>{
 const html=renderToStaticMarkup(React.createElement(QuoteLetter,{work:{codigoCorrelativo:'TRB-EJEMPLO',subtipoNombre:'Gas',cliente:{nombreCompleto:'Anterior'}},quote:{...quote,datosFormularioJson:{carta:{...quote.datosFormularioJson.carta,alcance:'<script>alert(1)</script>'}}}}));
 assert.ok(html.includes('quote-header.png'));assert.ok(html.includes('quote-footer.png'));
 assert.ok(html.includes('Marta Soto'));assert.ok(html.includes('05/11/2026'));
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('Vivienda de ejemplo'));assert.ok(!html.includes('Administrador'));
});
test('document dates use Bolivia even around a UTC date boundary',()=>{
 assert.equal(quoteDate('2026-10-23T02:00:00Z'),'22/10/2026');
 assert.equal(quoteDate('invalid'),'');
});

const { defaultQuoteTemplate, quoteTemplateSchema } = require('../src/lib/quote-template.ts');
test('custom stationery renders saved colors, text and paper while preserving signature and totals',()=>{
 const formato={...defaultQuoteTemplate,empresa:'Empresa de ejemplo',titulo:'PROPUESTA',encabezadoImagen:'',pieImagen:'',pieTexto:'Contacto de ejemplo',colorTexto:'#123456',colorSecciones:'#eeeeee',papel:'a4',fuente:15};
 const html=renderToStaticMarkup(React.createElement(QuoteLetter,{work:{codigoCorrelativo:'TEST'},quote:{...quote,datosFormularioJson:{carta:{...quote.datosFormularioJson.carta,formato}}}}));
 for(const value of ['PROPUESTA','Empresa de ejemplo','Contacto de ejemplo','Marta Soto','#123456','data-paper="a4"','size: a4']) assert.ok(html.includes(value),value);
 assert.ok(!html.includes('src="/quote-header.png"'));assert.ok(html.includes('2.430,00'));
});
test('template rejects executable content sources and CSS injection',()=>{
 for(const patch of [{encabezadoImagen:'https://tracker.example/image.png'},{pieImagen:'data:image/svg+xml;base64,PHN2Zz4='},{colorTexto:'red;display:none'},{papel:'a4; margin:0'},{fuente:40}]) assert.equal(quoteTemplateSchema.safeParse({...defaultQuoteTemplate,...patch}).success,false);
});

test('independent project budget identifies professional fees without fabricated installation measurements',()=>{
 const rows=quoteDocumentRows({...quote,snapshotCalculoJson:{},datosFormularioJson:{carta:{modalidad:'PROYECTO_INDEPENDIENTE'}}});
 assert.ok(rows.some(row=>row.concept==='Honorarios del proyecto'));assert.ok(!rows.some(row=>/lineales|Mano de obra/.test(row.concept)));
});
