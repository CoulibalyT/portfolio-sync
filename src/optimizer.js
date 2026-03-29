const sharp = require('sharp');

async function optimizeImage(buffer, options = {}) {
  const { quality = 90, format = 'webp', maxWidth } = options;

  let sharpInstance = sharp(buffer);

  // Resize si maxWidth est défini
  if (maxWidth) {
    sharpInstance = sharpInstance.resize({ width: maxWidth, withoutEnlargement: true });
  }
  
  // Appliquer le format et la qualité selon le type demandé
  switch (format.toLowerCase()) {
    case 'webp':
      sharpInstance = sharpInstance.webp({ quality });
      break;
    case 'jpeg':
    case 'jpg':
      sharpInstance = sharpInstance.jpeg({ quality });
      break;
    case 'png':
      sharpInstance = sharpInstance.png({ 
        quality,
        compressionLevel: 9
      });
      break;
    case 'avif':
      sharpInstance = sharpInstance.avif({ quality });
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
  
  return await sharpInstance.toBuffer();
}

module.exports = {
  optimizeImage
};
