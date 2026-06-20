# ✦ FaithWork — Red Social Laboral para la Iglesia (v3)

## Novedades de esta versión
- ✅ **CORREGIDO:** bug que dejaba en blanco el perfil y el formulario de publicar oferta
- ✅ Foto de perfil (personas y empresas) — sube y se ve en todos lados
- ✅ Feed social separado ("Publicaciones") con texto, fotos y videos
- ✅ Publicaciones con Like y Comentarios
- ✅ Las publicaciones de cada persona/empresa se muestran en su perfil
- ✅ Almacenamiento de archivos en Cloudinary (persistente, gratis)

## Funcionalidades completas
- Registro e inicio de sesión con JWT (personas y empresas)
- Recuperar contraseña vía email (Resend)
- Foto de perfil con subida directa
- Feed social: texto + hasta 6 fotos/videos por publicación, like, comentarios
- Publicación y búsqueda de ofertas de trabajo con filtros avanzados
- Sistema de aplicaciones a empleos
- Red de contactos (solo entre personas)
- Chat en tiempo real (WebSockets)
- Compartir ofertas con contactos por chat
- Calificaciones bidireccionales (empleado/empleador)
- Perfiles con reseñas y publicaciones de la comunidad

---

## ⚙️ VARIABLES DE ENTORNO REQUERIDAS (Railway)

En Railway → tu servicio → pestaña **Variables**, agrega TODAS estas:

| Variable | Valor |
|---|---|
| `JWT_SECRET` | una clave larga y secreta |
| `RESEND_API_KEY` | tu API key de Resend (empieza con `re_...`) |
| `EMAIL_FROM` | `onboarding@resend.dev` |
| `APP_URL` | tu URL pública de Railway |
| `CLOUDINARY_CLOUD_NAME` | tu Cloud Name de Cloudinary |
| `CLOUDINARY_API_KEY` | tu API Key de Cloudinary |
| `CLOUDINARY_API_SECRET` | tu API Secret de Cloudinary |
| `PORT` | `3000` |

**Cómo obtener las credenciales de Cloudinary:**
1. Ve a https://cloudinary.com → crea cuenta gratis
2. En el Dashboard verás: Cloud Name, API Key, API Secret (clic en "Reveal")
3. Copia esos 3 valores a las variables de Railway

---

## 🚀 Cómo subir los cambios

1. Reemplaza TODOS los archivos del repo de GitHub con los de este ZIP
   - Carpetas: `db/`, `middleware/`, `public/`, `routes/`, `utils/`
   - Archivos: `server.js`, `package.json`, etc.
2. Sube los cambios ("Commit changes")
3. Agrega las 7 variables de entorno nuevas en Railway si no las tienes
4. Railway redesplegará automáticamente

---

## Correr localmente

```bash
npm install
cp .env.example .env
# Edita .env con tus valores reales
npm start
# Abre http://localhost:3000
```

## Stack tecnológico
- **Backend:** Node.js + Express
- **Base de datos:** SQLite (sql.js)
- **Autenticación:** JWT
- **Chat:** WebSockets
- **Email:** Resend
- **Almacenamiento de archivos:** Cloudinary
- **Frontend:** HTML5 + CSS3 + JavaScript puro
