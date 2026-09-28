// Custom drag preview for snacks: just the artwork, no square icon cell.
//
// Chromium paints an on-page element passed to setDragImage() together with
// whatever is behind it (here the cell's square background). A *detached*
// <img> is used as a plain bitmap instead, so each snack is pre-rendered
// off-page at the size it is drawn on screen.

// Remembers the ready-made drag picture for each snack image on screen.
const cache = new WeakMap<
  HTMLImageElement,
  { image: HTMLImageElement; width: number; height: number }
>()

/** Size of the artwork inside an object-fit: contain <img>. */
function containedSize(img: HTMLImageElement): { width: number; height: number } {
  const scale = Math.min(img.clientWidth / img.naturalWidth, img.clientHeight / img.naturalHeight)
  return {
    width: Math.round(img.naturalWidth * scale),
    height: Math.round(img.naturalHeight * scale)
  }
}

/** Call once the on-screen snack <img> has loaded. */
export function prepareSnackDragImage(img: HTMLImageElement): void {
  if (!img.naturalWidth || !img.clientWidth) return
  const { width, height } = containedSize(img)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(img, 0, 0, width, height)
  const image = new Image()
  image.src = canvas.toDataURL('image/png')
  cache.set(img, { image, width, height })
}

/** Uses the pre-rendered artwork as the drag preview, keeping the grab point under the cursor. */
export function setSnackDragImage(event: DragEvent, img: HTMLImageElement): void {
  const prepared = cache.get(img)
  if (!prepared || !prepared.image.complete || !event.dataTransfer) return
  const rect = img.getBoundingClientRect()
  const left = rect.left + (rect.width - prepared.width) / 2
  const top = rect.top + (rect.height - prepared.height) / 2
  event.dataTransfer.setDragImage(prepared.image, event.clientX - left, event.clientY - top)
}
