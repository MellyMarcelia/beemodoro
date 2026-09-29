// When you drag a snack, we want only the snack picture to follow your mouse,
// not the square box behind it. By default the square box would come along
// too, so we make a separate copy of each picture ahead of time and drag that
// copy instead.

// The ready-made copy for each snack picture on screen.
const cache = new WeakMap<
  HTMLImageElement,
  { image: HTMLImageElement; width: number; height: number }
>()

// The size the snack picture is actually drawn at on screen.
function containedSize(img: HTMLImageElement): { width: number; height: number } {
  const scale = Math.min(img.clientWidth / img.naturalWidth, img.clientHeight / img.naturalHeight)
  return {
    width: Math.round(img.naturalWidth * scale),
    height: Math.round(img.naturalHeight * scale)
  }
}

// Makes the copy of a snack picture. Called once the picture has loaded.
export function prepareSnackDragImage(img: HTMLImageElement): void {
  // Picture not loaded or not visible yet? Nothing to copy.
  if (!img.naturalWidth || !img.clientWidth) return
  const { width, height } = containedSize(img)
  // Draw the picture onto a blank, invisible sheet at its on-screen size...
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(img, 0, 0, width, height)
  // ...turn that sheet into a new picture...
  const image = new Image()
  image.src = canvas.toDataURL('image/png')
  // ...and keep it for when you start dragging.
  cache.set(img, { image, width, height })
}

// Swaps in the copy while dragging, lined up so the spot you grabbed stays
// under your mouse.
export function setSnackDragImage(event: DragEvent, img: HTMLImageElement): void {
  const prepared = cache.get(img)
  // No copy ready yet? Let the normal drag happen instead.
  if (!prepared || !prepared.image.complete || !event.dataTransfer) return
  // Work out where the picture's top-left corner is on screen (it's centred
  // in its box), then how far your mouse is from that corner.
  const rect = img.getBoundingClientRect()
  const left = rect.left + (rect.width - prepared.width) / 2
  const top = rect.top + (rect.height - prepared.height) / 2
  event.dataTransfer.setDragImage(prepared.image, event.clientX - left, event.clientY - top)
}
