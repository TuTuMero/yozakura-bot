# 🌸 Instituto Yozakura — Bot de Discord & Sistema de Admisión

Bot de Discord desarrollado para la comunidad de Roleplay de **Yozakura High**. Este proyecto integra un bot modular en **Node.js (Discord.js)** con una base de datos en **Supabase (PostgreSQL)** y paneles web externos alojados en **Netlify** para la gestión de usuarios y el equipo de staff.

---

## 🚀 Características Principales

* **Sistema de Verificación de Roblox:** Los usuarios vinculan su cuenta de Roblox mediante un modal interactivo, actualizando automáticamente su apodo en el servidor y gestionando roles a través de Supabase.
* **Sistema de Fichas de Admisión Dinámicas:** 
  * Panel interactivo (`/setup-fichas`) que genera un enlace personalizado y efímero (`ephemeral`) para cada usuario.
  * Inyección automática de parámetros (`discord_id` y nombre de usuario de Roblox) hacia la aplicación web en Netlify para autocompletar los formularios.
* **Panel de Revisión para el Staff:**
  * Comando protegido (`/config-fichas`) que valida en tiempo real los roles de moderación directamente desde la base de datos de Supabase.
  * Generación de sesiones web seguras para que el staff evalúe, acepte o rechace las fichas de los aspirantes desde el panel web de revisión.

---

## 🛠️ Tecnologías Utilizadas

* **Node.js** (Discord.js v14)
* **Supabase** (Base de datos relacional PostgreSQL)
* **Netlify** (Frontend para las páginas web de fichas y panel de staff)
* **Dotenv** (Gestión de variables de entorno)

---

## 📌 Estado del Proyecto & Cosas Pendientes
El proyecto se encuentra funcional en su núcleo de automatización y flujos principales de verificación, bases de datos y entrega de sesiones web. Algunas secciones se mantuvieron en fase de experimentación o pendientes de pulir debido al proceso de aprendizaje y refactorización del código base:
* Organización y estructuración final de controladores en el archivo principal.
* Ajustes menores en los webhooks de notificación automática ante rechazos de fichas.

---

## ⚙️ Configuración e Instalación Local

1. Clona el repositorio:
   ```bash
   git clone [https://github.com/TuTuMero/yozakura-bot.git](https://github.com/TuTuMero/yozakura-bot.git)
