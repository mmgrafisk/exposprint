import driveResources from "@/data/google-drive-resources.json";

const files = driveResources.files as Record<string, string>;

export function drivePdfUrl(filename: string) {
  const id = files[filename];
  return id ? `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t` : driveResources.folderUrl;
}

export function localizedDrivePdfUrl(basename: string, locale: string) {
  return drivePdfUrl(`${basename}-${locale}.pdf`);
}
