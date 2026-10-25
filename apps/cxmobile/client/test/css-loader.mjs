const staticAssetExtensions = [
  ".css",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".woff",
  ".woff2",
  ".ttf"
];

export async function load(url, context, nextLoad) {
  const isStatic = staticAssetExtensions.some(
    (ext) => url.endsWith(ext) || url.includes(`${ext}?`)
  );
  if (isStatic) {
    return {
      format: "module",
      shortCircuit: true,
      source: "export default {};"
    };
  }
  return nextLoad(url, context);
}
