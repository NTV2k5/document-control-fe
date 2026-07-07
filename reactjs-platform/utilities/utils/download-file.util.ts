/**
 * Downloads a file from a given URL
 * @param url - The URL to download the file from
 * @param filename - The filename to save the file as (optional)
 */
export function downloadFile(url: string, filename?: string): void {
  const link = document.createElement('a');
  link.href = url;

  if (filename) {
    link.download = filename;
  }

  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
