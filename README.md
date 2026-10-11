# 🔥 Servigaz CRM — Sistema de Gestión Comercial y Operativa

Sistema CRM integral desarrollado para la empresa **Servigaz**, diseñado para la gestión y seguimiento del ciclo completo de trabajos de gas, calefacción, plomería, venta de equipos y servicios técnicos según la especificación técnica v12.

---

## 🚀 Tecnologías Principales

- **Frontend & Backend:** [Next.js 14](https://nextjs.org/) (App Router, Server & Client Components)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Estilos:** [Tailwind CSS](https://tailwindcss.com/)
- **Base de Datos & ORM:** [PostgreSQL](https://www.postgresql.org/) + [Prisma ORM](https://www.prisma.io/)
- **Autenticación:** JWT con control de roles (`ADMIN`, `ENCARGADO`, `TECNICO_FIJO`)
- **Contenedores:** Docker & Docker Compose

---

## 📦 Características y Fases Implementadas

1. **Gestión de Clientes & Contactos:** Búsqueda rápida por nombre y teléfono, historial de servicios y georreferenciación.
2. **Wizard Inteligente de Órdenes:**
   - Flujo Completo (Levantamiento técnico en terreno para cañerías/obras).
   - Flujo Directo Simplificado (Obras directas, alquiler de herramientas, venta en tienda y trámites sin medición obligatoria).
3. **Cotizador Dinámico en Bolivianos (Bs.):** Presupuestos automáticos con snapshot inmutable y emisión en PDF / WhatsApp.
4. **Cobros & Pagos Multiformato:** Efectivo en caja, QR Bancario/Simple, Transferencia bancaria, Tarjeta POS y Cheques.
5. **Control de Ejecución e Inventario:**
   - Descuento de stock en tiempo real desde tienda y almacén.
   - Costeo Promedio Ponderado para compras a proveedores oficiales (#96).
6. **Cierre Financiero Inmutable (#84):** Registro exacto de costos directos (materiales consumidos, mano de obra pagada y transporte).
7. **Certificado de Garantía con QR:** Emisión y validación digital con código QR.
8. **Finanzas Generales & Estado de Resultados (Fase 19):**
   - Ingresos reales vs Costos directos de trabajos vs Gastos operativos de oficina.
   - Control de privacidad por usuario (#91).
9. **Control de Asistencia de Personal (Fase 18):** Marcación de entrada/salida y cálculo de tiempos.

---

## 🛠️ Puesta en Marcha Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/bsarmientom1993-ctrl/ServigazCRM.git
cd ServigazCRM
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` basado en `.env.example`:
```env
DATABASE_URL="postgresql://servigaz_user:servigaz_password@localhost:5432/servigaz_db?schema=public"
JWT_SECRET="servigaz-crm-super-secret-key-change-in-prod"
NEXTAUTH_SECRET="servigaz-crm-super-secret-key-change-in-prod"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Iniciar Base de Datos con Docker
```bash
docker compose up -d
```

### 5. Migraciones y Seed de la Base de Datos
```bash
npx prisma db push
npx prisma db seed
```

### 6. Iniciar Servidor de Desarrollo
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 👥 Credenciales de Acceso por Defecto

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| **Administrador** | `admin@servigaz.cl` | `Admin123!` |
| **Encargado** | `encargado@servigaz.cl` | `Admin123!` |
| **Técnico** | `tecnico@servigaz.cl` | `Tecnico123!` |
