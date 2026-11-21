# COPRODA — Sistema de gestión empresarial con agente conversacional

## Descripción

Sistema de información web desarrollado a medida para **COPRODA**, empresa guatemalteca de manufactura. El sistema centraliza en una sola plataforma el ciclo operativo de la empresa: pedidos y ventas, clientes y cuentas por cobrar, abonos y bancos, compras, bodega e inventario (producto terminado, a granel y materia prima), producción (recetas/BOM, rutas de proceso, órdenes de producción con consumo teórico vs. real) y reportes exportables a Excel.

Incluye un **agente conversacional** de solo lectura para el equipo de ventas que responde en lenguaje natural sobre clientes, saldos, órdenes, precios y existencias, mediante *function calling* sobre la API REST del sistema.

El proyecto se desarrolló como Trabajo de Graduación (modalidad trabajo profesional) de la Licenciatura en Ingeniería en Ciencia de la Computación y Tecnologías de la Información, Universidad del Valle de Guatemala.

## Tecnologías Utilizadas

- **Frontend:** React 19, Vite 7, Material UI 7, React Router 7, Day.js, ExcelJS
- **Backend:** Python, Flask, Flask-SQLAlchemy, Flask-Migrate, Flask-CORS, openpyxl
- **Base de datos:** PostgreSQL
- **Agente conversacional:** Python, SDK de Anthropic (Claude) con *function calling*, WhatsApp Cloud API (pruebas)

## Estructura del repositorio

```
├── capturas/          Capturas del sistema en funcionamiento (captura-01 … captura-NN)
├── demo/demo.mp4      Video demostrativo
├── docs/              Informe final y consentimiento firmado
├── src/
│   ├── .env.example   Variables de entorno de ejemplo
│   ├── frontend/      Aplicación web (React + Vite)
│   └── backend/       API REST (Flask) y agente conversacional (backend/agente)
└── README.md
```

## Requisitos Previos

- Node.js v18 o superior y npm
- Python 3.10 o superior (el agente requiere ≥ 3.10)
- PostgreSQL 14 o superior
- Git

## Instalación

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/GraduacionesUVG/2026-22562-mesias-flores-alexis.git
   cd 2026-22562-mesias-flores-alexis
   ```

2. Crear la base de datos en PostgreSQL:
   ```bash
   createdb coproda
   ```

3. Configurar y levantar el **backend**:
   ```bash
   cd src/backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp ../.env.example .env          # editar DATABASE_URL y SECRET_KEY
   set -a; source .env; set +a      # cargar variables de entorno
   flask --app app:create_app db init
   flask --app app:create_app db migrate -m "inicial"
   flask --app app:create_app db upgrade
   python app.py                    # API en http://localhost:5000/coproda
   ```

4. Configurar y levantar el **frontend** (en otra terminal):
   ```bash
   cd src/frontend
   npm install
   # En src/config/api.jsx cambiar API_BASE_URL a http://localhost:5000/coproda
   npm run dev                      # aplicación en http://localhost:5173
   ```

5. (Opcional) Ejecutar el **agente conversacional**:
   ```bash
   cd src/backend/agente
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env             # configurar AGENTE_BACKEND y COPRODA_API_URL
   python main.py                   # REPL en consola: /ayuda, /tools, /debug, /nuevo, /salir
   ```
   Más detalles en [src/backend/agente/README.md](src/backend/agente/README.md).

## Ejecución

| Componente | Comando | URL |
|---|---|---|
| Backend | `python app.py` (en `src/backend`) | http://localhost:5000/coproda |
| Frontend | `npm run dev` (en `src/frontend`) | http://localhost:5173 |
| Build de producción del frontend | `npm run build` | genera `src/frontend/dist` |
| Agente | `python main.py` (en `src/backend/agente`) | consola |

## Capturas

Las capturas del sistema en funcionamiento se encuentran en la carpeta [/capturas](capturas/).

## Demo

El video demostrativo está disponible en [/demo/demo.mp4](demo/demo.mp4).

## Documentación

- Informe final: [/docs/informe_final.pdf](docs/informe_final.pdf)
- Consentimiento firmado: [/docs/consentimiento_firmado.pdf](docs/consentimiento_firmado.pdf)

## Autores

- Alexis Mesias Flores - 22562

## Licencia

Todos los derechos reservados. Software desarrollado para COPRODA; se publica únicamente con fines académicos de evaluación del Trabajo de Graduación de la Universidad del Valle de Guatemala.
