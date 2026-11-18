/** Browser URL for a MEDIA_DIR-relative file (served by app/api/media). Safe to import from client components. */
export const mediaUrl = (rel: string) => `/api/media/${rel.split("/").map(encodeURIComponent).join("/")}`;
