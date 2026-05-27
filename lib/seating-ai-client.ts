export async function imageFileToBase64Payload(
  file: File,
): Promise<{ imageBase64: string; mimeType: string }> {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
  const mimeType = (allowed.includes(file.type as (typeof allowed)[number])
    ? file.type
    : "image/jpeg") as (typeof allowed)[number];

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }

  return { imageBase64: btoa(binary), mimeType };
}
