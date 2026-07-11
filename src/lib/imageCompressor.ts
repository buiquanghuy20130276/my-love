/**
 * Compresses an image file on the client side to WebP format.
 * Downscales the image if it exceeds the maxDimension.
 * 
 * @param file The original image file to compress
 * @param maxDimension The maximum width or height of the compressed image
 * @param quality The WebP output quality (0.0 to 1.0)
 * @returns A promise resolving to a compressed Blob (or original File if not an image or fails)
 */
export function compressImage(file: File, maxDimension: number = 2560, quality: number = 0.85): Promise<Blob> {
  return new Promise((resolve) => {
    // If it's not an image file, pass it through directly
    if (!file.type.startsWith('image/')) {
      resolve(file)
      return
    }

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          // Downscale only if larger than the limit
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width)
              width = maxDimension
            } else {
              width = Math.round((width * maxDimension) / height)
              height = maxDimension
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                resolve(file) // Fallback to original file if blob conversion fails
              }
            },
            'image/webp',
            quality
          )
        } catch (err) {
          console.warn('Canvas image compression failed, using original file:', err)
          resolve(file) // Fallback
        }
      }
      img.onerror = () => {
        resolve(file) // Fallback
      }
    }
    reader.onerror = () => {
      resolve(file) // Fallback
    }
  })
}
