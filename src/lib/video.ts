// all the annoying video stuff lives here.
// every browser records video differently, so we have to be careful

// best first. chrome can do webm, safari can only do mp4
const typesToTry = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4;codecs=avc1',
  'video/mp4',
]

// picks the first format this browser can actually record.
// empty string = let the browser choose
export function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const type of typesToTry) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

// "video/webm;codecs=vp9" -> "webm"
export function fileExtension(mimeType: string): string {
  return mimeType.includes('mp4') ? 'mp4' : 'webm'
}

// "video/webm;codecs=vp9" -> "video/webm" (what storage wants)
export function baseType(mimeType: string): string {
  return mimeType.split(';')[0] || 'video/webm'
}

// turns on the camera. tries 3 times, asking for less each time:
//  1. back camera + mic (phones)
//  2. any camera + mic (laptops dont have a back camera)
//  3. camera only (if the mic is missing, asking for audio fails EVERYTHING)
export async function getCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('This browser cannot use the camera. The page has to be on https (or localhost).')
  }

  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: 'environment' } }, audio: true },
    { video: true, audio: true },
    { video: true, audio: false },
  ]

  let lastError: unknown = null
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      lastError = err
      // if the person said no, asking again wont help
      if (err instanceof DOMException && err.name === 'NotAllowedError') break
    }
  }

  if (lastError instanceof DOMException && lastError.name === 'NotAllowedError') {
    throw new Error('Camera access was blocked. Allow the camera in your browser settings and try again.')
  }
  throw lastError
}

// turns off the camera light
export function stopCamera(stream: MediaStream | null) {
  if (!stream) return
  stream.getTracks().forEach((track) => track.stop())
}

// grabs one frame from the video as a jpeg, so the grid has something
// to show while the real videos are still loading.
// gives back null if it doesnt work (the poster is optional anyway)
export function makePoster(videoBlob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(videoBlob)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    let done = false
    function finish(result: Blob | null) {
      if (done) return
      done = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(result)
    }

    // give up after 5 seconds
    const timer = setTimeout(() => finish(null), 5000)

    // once it has loaded, jump a tiny bit in (frame 0 is black sometimes)
    video.onloadeddata = () => {
      video.currentTime = 0.1
    }

    video.onseeked = () => {
      if (!video.videoWidth) {
        finish(null)
        return
      }
      // shrink it down, posters dont need to be big
      const scale = Math.min(1, 480 / video.videoWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        finish(null)
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.8)
    }

    video.onerror = () => finish(null)
    video.src = url
  })
}
