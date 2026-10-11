import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      serviciosActivos = ["GAS"],
      formData = {},
      dificultadNivel = 1,
      porcentajeDescuento = 0,
    } = body;

    const configDificultad = await prisma.configuracionDificultad.findUnique({
      where: { nivel: Number(dificultadNivel || 1) },
    });
    const factorDificultad = Number(configDificultad?.factorMultiplicador || 1.0);
    const sugiereInstaladorExtra = configDificultad?.sugerenciaInstaladorExtra || false;

    let subtotalMateriales = 0;
    let subtotalManoObra = 0;
    let itemsDesglose: any[] = [];

    // 1. GAS (Precios en Bolivianos Bs.)
    if (serviciosActivos.includes("GAS")) {
      const medidores = Number(formData.gasMedidores || 1);
      const subMedidores = medidores * 350; // Bs. 350 por gabinete
      const subProyectoGas = formData.gasIncluyeProyecto ? 650 : 0; // Bs. 650 proyecto
      const metrosGasVisto = Number(formData.gasMetrosVisto || 0);
      const subGasVisto = metrosGasVisto * 85; // Bs. 85 / metro
      const metrosGasEmp = Number(formData.gasMetrosEmpotrado || 0);
      const subGasEmp = metrosGasEmp * 125; // Bs. 125 / metro

      const totalMatGas = subMedidores + subProyectoGas + subGasVisto + subGasEmp;
      subtotalMateriales += totalMatGas;

      const totalMetrosGas = metrosGasVisto + metrosGasEmp;
      const moGas = totalMetrosGas * 45 * factorDificultad; // Bs. 45 / metro MO
      subtotalManoObra += moGas;

      itemsDesglose.push({
        modulo: "🔥 Gas",
        detalle: `Gabinete (${medidores} un), Tuberías Cobre (${totalMetrosGas}m)${formData.gasIncluyeProyecto ? ", Proyecto YPFB/SEC" : ""}`,
        materiales: totalMatGas,
        manoObra: moGas,
      });
    }

    // 2. CALEFACCIÓN (Bolivianos Bs.)
    if (serviciosActivos.includes("CALEFACCION")) {
      let matCal = 0;
      let moCal = 0;

      if (formData.calefaccionTipo === "PISO") {
        const m2 = Number(formData.calM2Piso || 0);
        matCal = m2 * 220; // Bs. 220 / m2
        moCal = m2 * 60 * factorDificultad;
        itemsDesglose.push({
          modulo: "❄️ Piso Radiante",
          detalle: `Losa de Piso Radiante (${m2} m²)`,
          materiales: matCal,
          manoObra: moCal,
        });
      } else {
        const metrosTubos = Number(formData.calMetrosTubo || 0);
        const subTubos = metrosTubos * 65;
        const cantRad = Number(formData.calCantRadiadores || 0);
        const subRad = cantRad * Number(formData.calPrecioRadiador || 450); // Bs. 450 / elemento
        matCal = subTubos + subRad;
        moCal = metrosTubos * 40 * factorDificultad;
        itemsDesglose.push({
          modulo: "❄️ Radiadores",
          detalle: `Tuberías (${metrosTubos}m) + ${cantRad} Radiadores`,
          materiales: matCal,
          manoObra: moCal,
        });
      }

      subtotalMateriales += matCal;
      subtotalManoObra += moCal;
    }

    // 3. PLOMERÍA (Bolivianos Bs.)
    if (serviciosActivos.includes("PLOMERIA")) {
      const puntosAgua = Number(formData.plomeriaPuntosAgua || 2);
      const subMatPlom = puntosAgua * 180; // Bs. 180 / punto
      const subMoPlom = puntosAgua * 150 * factorDificultad; // Bs. 150 MO

      subtotalMateriales += subMatPlom;
      subtotalManoObra += subMoPlom;

      itemsDesglose.push({
        modulo: "💧 Plomería",
        detalle: `Instalación de ${puntosAgua} puntos hidráulicos (Agua Fría/Caliente)`,
        materiales: subMatPlom,
        manoObra: subMoPlom,
      });
    }

    // 4. EQUIPOS (Bolivianos Bs.)
    if (serviciosActivos.includes("EQUIPOS")) {
      const precioEquipo = Number(formData.equiposPrecio || 4800); // Bs. 4.800
      const moEquipo = Number(formData.equiposManoObra || 450) * factorDificultad;

      subtotalMateriales += precioEquipo;
      subtotalManoObra += moEquipo;

      itemsDesglose.push({
        modulo: "🛠️ Equipos",
        detalle: `${formData.equiposNombre || "Caldera Mural 24kW"} (Provisión y Montaje)`,
        materiales: precioEquipo,
        manoObra: moEquipo,
      });
    }

    // 5. OTROS SERVICIOS (Bolivianos Bs.)
    if (serviciosActivos.includes("OFICINA_TRAMITES") || serviciosActivos.includes("OTROS")) {
      let subMatOfic = 0;
      let subMoOfic = 0;
      const tipoTramite = formData.oficinaTipo || "HERMETICIDAD";

      if (tipoTramite === "HERMETICIDAD") {
        subMoOfic = 280 * factorDificultad; // Bs. 280
        itemsDesglose.push({
          modulo: "📋 Otros",
          detalle: "Prueba de Hermeticidad Manométrica de Red de Gas",
          materiales: 0,
          manoObra: subMoOfic,
        });
      } else if (tipoTramite === "CAMBIO_MEDIDOR") {
        subMatOfic = 120;
        subMoOfic = 200 * factorDificultad;
        itemsDesglose.push({
          modulo: "📋 Medidor",
          detalle: "Desconexión, Montaje y Sellado de Medidor de Gas",
          materiales: subMatOfic,
          manoObra: subMoOfic,
        });
      } else if (tipoTramite === "ALQUILER_HERRAMIENTAS") {
        const dias = Number(formData.alquilerDias || 1);
        const tarifaDia = Number(formData.alquilerTarifaDia || 120); // Bs. 120 / día
        subMatOfic = dias * tarifaDia;
        itemsDesglose.push({
          modulo: "📋 Arriendo",
          detalle: `Alquiler de Termofusora / Herramienta (${dias} día/s)`,
          materiales: subMatOfic,
          manoObra: 0,
        });
      }

      subtotalMateriales += subMatOfic;
      subtotalManoObra += subMoOfic;
    }

    // 6. TIENDA (Bolivianos Bs.)
    if (serviciosActivos.includes("TIENDA")) {
      const subTienda = Number(formData.tiendaMaterialesTotal || 0);
      subtotalMateriales += subTienda;
      itemsDesglose.push({
        modulo: "📦 Tienda",
        detalle: "Materiales e insumos comprados en mostrador",
        materiales: subTienda,
        manoObra: 0,
      });
    }

    const montoTransporte = Number(formData.transporte || 150); // Bs. 150
    const subtotalBruto = subtotalMateriales + subtotalManoObra + montoTransporte;
    const descPct = Number(porcentajeDescuento || 0);
    const montoDescuento = (subtotalBruto * descPct) / 100;
    const totalCotizado = subtotalBruto - montoDescuento;

    const anticipoMinimo = totalCotizado * 0.5;
    const costoEstimado = subtotalMateriales * 0.7 + subtotalManoObra * 0.5 + montoTransporte;
    const ganancia = totalCotizado - costoEstimado;
    const margenPct = Math.round((ganancia / (totalCotizado || 1)) * 100);

    return NextResponse.json({
      moneda: "Bs.",
      subtotalMateriales,
      subtotalManoObra,
      factorDificultad,
      sugiereInstaladorExtra,
      montoTransporte,
      montoDescuento,
      porcentajeDescuento: descPct,
      totalCotizado,
      anticipoMinimo,
      margenPct,
      alertaBajoMargen: margenPct < 20.0,
      itemsDesglose,
    });
  } catch (error: any) {
    console.error("Cotizador calculation error:", error);
    return NextResponse.json({ error: "Error en el cálculo" }, { status: 500 });
  }
}
